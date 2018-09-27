# babel-plugin-classname
A babel plugin for referencing parent `className` like  `&` in Sass(Less).

# Install
`yarn add babel-plugin-classname --dev`

# Configuration
Via .babelrc or babel-loader.
```
{
  "plugins": [["classname", options]]
}
```

## options
Options can be a object with properties below:
- flag: the string will be replaced by parent className. default: '&'

For Example:
```
.babelrc
"plugins": [
  ["classname", {"flag": "&"}]
]
```


# Usage
## Concepts
### 1. replaceable className
only the className of type string and includes the flag in option will be transformed by this plugin. for example:
```javascript
// flag: '&'
// before
<div className="test">
  <div className"&-1"/>
</div>

// after
<div className="test">
  <div className"test-1"/>
</div>
```

### 2. lowest ancestor className
className of the lowest ancestor element which has a className attribute and the value of className attribute is a string or jsx expression in AST. for example:
```javascript
// before
<div className="lowest">
  <div>
    <div className="&-1"/>
  </div>
</div>

// after
<div className="lowest">
  <div>
    <div className="lowest-1"/>
  </div>
</div>
```

## How it works
We can describe the working process of this plugin with those two concepts above. Encounter the jsx element with a `replaceable className` in the AST traversal, then replace the `flag` with the `lowest ancestor className`. So, enjoy it.

# Test
You can clone this project, the place your source code in `demo/source`, then run `yarn demo`. The resule code file will be generated in `demo/target`.