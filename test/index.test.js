const fs = require('fs');
const path = require('path');
const { expect } = require('chai');
const plugin = require('../lib/transformer').default;
const { transformFileSync } = require("@babel/core");

function transform(sourcePath) {
  return transformFileSync(sourcePath, {
    plugins: [plugin],
    generatorOpts: {
      compact: false,
    }
  }).code || '';
}

const casesDir = path.resolve(__dirname, 'fixtures');
const cases = fs.readdirSync(casesDir);

describe('test case', () => { 
  cases.forEach(dir => {
    const sourceFile = path.resolve(casesDir, dir, 'source.tsx');
    const expectFile = path.resolve(casesDir, dir, 'expect.tsx');
    const expextText = fs.readFileSync(expectFile).toString();
    const result = transform(sourceFile);
    it(`test ${dir}`, () => {
      expect(result).to.equal(expextText);
    })
  });
});