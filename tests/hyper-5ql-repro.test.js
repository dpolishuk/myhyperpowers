const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

test('hyper-5ql: Task A: file1.txt should exist with correct content', () => {
  const filePath = path.join(__dirname, 'verification-workspace', 'file1.txt');
  
  assert.strictEqual(fs.existsSync(filePath), true, 'file1.txt should exist');
  
  const content = fs.readFileSync(filePath, 'utf8');
  assert.strictEqual(content, 'Initial content', 'Content should be "Initial content"');
});
