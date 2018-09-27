import { Expression, JSXOpeningElement, JSXExpressionContainer, StringLiteral, isStringLiteral, isJSXIdentifier, isJSXExpressionContainer, JSXAttribute, stringLiteral, templateElement, isTemplateLiteral, templateLiteral, TemplateLiteral, jsxExpressionContainer, TemplateElement, cloneNode, JSXSpreadAttribute, isJSXSpreadAttribute } from '@babel/types';
import { PluginObj, Visitor } from '@babel/core';

declare module "@babel/types" {
  export function cloneNode<T extends Node>(n: T): T;
}

export interface Options {
  flag?: string;
};

const defaultOptions: Options = {
  flag: '&'
};

type ExpectClassValue = JSXExpressionContainer | StringLiteral;
type ReplaceClassVisitorState = {newClassValue: ExpectClassValue};

function pluginExsist(plugins: (string | string[])[], name: string) {
  return plugins.some(p => (Array.isArray(p) ? p[0]: p) === name);
}

function isClassNameAttr(attr: JSXAttribute | JSXSpreadAttribute): attr is JSXAttribute {
  return !isJSXSpreadAttribute(attr) && isJSXIdentifier(attr.name) && attr.name.name === 'className';
}

function getExpectClass(node: JSXOpeningElement): ExpectClassValue | null {
  const className = node.attributes.find(attr => isClassNameAttr(attr));
  if (className) {
    const value = (className as JSXAttribute).value || {};
    if (isJSXExpressionContainer(value) || isStringLiteral(value)) {
      return value;
    }
  }
  return null;
}

function isReplacable(node: ExpectClassValue, flagRegexp: RegExp): node is StringLiteral {
  if (isStringLiteral(node) && flagRegexp.test(node.value)) {
    return true;
  }
  return false;
}

function createNewClassValue(parent: ExpectClassValue, current: string, flagRegexp: RegExp): ExpectClassValue {
  if (isStringLiteral(parent)) {
    const newValueText = current.replace(flagRegexp, parent.value.split(' ')[0]);
    return stringLiteral(newValueText);
  }
  let expression = parent.expression;
  if (isTemplateLiteral(expression)) {
    // 没有表达式的末班字符串当做普通字符串处理
    if (expression.expressions.length === 0) {
      const text = expression.quasis[0].value.cooked;
      const newValueText = current.replace(flagRegexp, text.split(' ')[0]);
      return stringLiteral(newValueText);
    }
  } else {
    expression = templateLiteral([templateElement({cooked: '', raw: ''}, false), templateElement({cooked: '', raw: ''}, true)], [expression])
  }
  const newTemplateLiteral = rebuildTemplate(expression, current, flagRegexp);
  return jsxExpressionContainer(newTemplateLiteral);
}

function rebuildTemplate(template: TemplateLiteral, current: string, flagRegexp: RegExp): TemplateLiteral {
  const matches = matchAll(flagRegexp, current);
  const firstQuaText = template.quasis[0].value.cooked;
  const flagLength = flagRegexp.source.length;
  let expressions: Expression[] = [];
  let quasis: TemplateElement[] = [];
  let index: number = 0;
  matches.forEach((m, i) => {
    const expressionsCopy = template.expressions.map(e => cloneNode(e));
    const quasisCopy = template.quasis.map(q => cloneNode(q));
    const left = current.slice(index, m.index);
    index = m.index + flagLength;
    let text = left + firstQuaText;
    if (quasis.length > 0) {
      const tailOfPrev = quasis.pop();
      text = tailOfPrev!.value.cooked + text;
    }
    quasisCopy[0] = templateElement({cooked: text, raw: text}, false);
    quasis = quasis.concat(quasisCopy);
    expressions = expressions.concat(expressionsCopy);
    if (i === matches.length - 1) {
      // 最后一个
      const tail = quasis.pop();
      const tailText = tail!.value.cooked + current.slice(index);
      quasis.push(templateElement({cooked: tailText, raw: tailText}, true));
    }
  })
  return templateLiteral(quasis, expressions);
}

function matchAll(regexp: RegExp, text: string) {
  // 手工置零， 防止其他地方使用过
  regexp.lastIndex = 0;
  const matches: RegExpExecArray[] = [];
  let match;
  while (match = regexp.exec(text)) {
    matches.push(match);
  }
  return matches;
}

export default function plugin(api: any): PluginObj {
  const replaceClassVisitor: Visitor<ReplaceClassVisitorState> = {
    JSXAttribute(path) {
      if (!isClassNameAttr(path.node)) {
        return;
      }
      const valuePath = path.get('value');
      valuePath.replaceWith(this.newClassValue);
    }
  }
  const classStack: ExpectClassValue[] = [];
  let index = -1;
  return {
    manipulateOptions(opts, parserOpts) {
      if (pluginExsist(parserOpts.plugins, 'typescript') || pluginExsist(parserOpts.plugins, 'jsx') ) {
        return;
      }
      parserOpts.plugins.push("jsx");
    },
    visitor: {
      JSXOpeningElement(path, state: any) {
        const { node } = path;
        let classValue = classStack[index];
        const expectValue = getExpectClass(node);
        // 可以被替换 
        if (expectValue) {
          let { flag } = Object.assign({} , defaultOptions, state.opts);
          const flagRegexp = new RegExp(flag!, 'g');
          if (isReplacable(expectValue, flagRegexp) && index > -1) {
            // 执行替换
            classValue = createNewClassValue(classValue, expectValue.value, flagRegexp);
            path.traverse<ReplaceClassVisitorState>(replaceClassVisitor, {newClassValue: classValue});
          } else {
            classValue = expectValue;
          }
        }
        // non-selfclosing element
        if (!node.selfClosing) {
          classStack.push(classValue);
          index++;
        }

      },
      JSXClosingElement() {
        classStack.pop();
        index--;
      },
    }
  };
}