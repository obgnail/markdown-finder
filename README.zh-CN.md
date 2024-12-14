#  Markdown Finder

[English](https://github.com/obgnail/markdown-finder/blob/master/README.md) | 简体中文

Markdown Finder 是一个基于 Node.js 的工具，用于在本地目录中搜索 Markdown 文件。它支持复杂的文法查询，以便精确定位所需的文件。



## 功能

- 支持复杂的文法查询，包括文件路径、文件名、扩展名、大小、时间、行号、字符数等。
- 支持正则表达式查询。
- 支持通过抽象语法树（AST）进行查询。



## 使用示例

```javascript
import { Finder } from "../dist/markdown-finder.js"

const dir = "D:/myshare/Dropbox/root/md"
const caseSensitive = false

async function query() {
    const finder = new Finder()
    console.log(finder.getGrammar())

    const iterator = finder.find("size>10kb | content:abc", dir, caseSensitive)
    for await (const source of iterator) {
        console.log(source.path)
    }
}

async function queryByAST() {
    const finder = new Finder()
    const ast = finder.parse(`file:/[a-z]{3}/ blockcodelang:python`)
    const iterator = finder.findByAst(ast, dir, caseSensitive)
    for await (const source of iterator) {
        console.log(source.path)
    }
}

query()
queryByAST()
```



## API

```javascript
import { Finder } from "../dist/markdown-finder.js"
const finder = new Finder()

// 获取查询文法
finder.getGrammar()

// 通过文法查询
const iterator = finder.find("size>10kb | content:abc", dir, caseSensitive)

// 通过抽象语法树查询
const ast = finder.parse(`file:/[a-z]{3}/ blockcodelang:python`)
const iterator = finder.findByAst(ast, dir, caseSensitive)
```



## 文法说明

```
<query> ::= <expression>
<expression> ::= <term> ( <or> <term> )*
<term> ::= <factor> ( <conjunction> <factor> )*
<factor> ::= <qualifier>? <match>
<qualifier> ::= <scope> <operator>
<match> ::= <keyword> | '"'<keyword>'"' | '/'<regexp>'/' | '('<expression>')'
<conjunction> ::= <and> | <not>
<or> ::= 'OR' | '|'
<and> ::= 'AND' | ' '
<not> ::= '-'
<keyword> ::= [^\s"()|]+
<regexp> ::= [^/]+
<operator> ::= ':' | '=' | '!=' | '>=' | '<=' | '>' | '<'
<scope> ::= 'path' | 'file' | 'ext' | 'time' | 'size' | 'linenum' | 'charnum' | 'chinesenum' | 'crlf' | 'hasimage' | 'haschinese' | 'default' | 'content' | 'line' | 'blockcode' | 'blockcodelang' | 'blockcodebody' | 'blockcodeline' | 'blockhtml' | 'blockquote' | 'table' | 'thead' | 'tbody' | 'ol' | 'ul' | 'task' | 'taskdone' | 'tasktodo' | 'head' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'highlight' | 'image' | 'code' | 'link' | 'strong' | 'em' | 'del'
```



## 示例解释

### 文法查询示例

```javascript
const iterator = finder.find("size>10kb | content:abc", dir, caseSensitive)
```

这个查询会找到文件大小大于 10KB 并且内容包含 "abc" 的 Markdown 文件。



### 通过 AST 查询示例

```javascript
const ast = finder.parse(`file:/[a-z]{3}/ blockcodelang:python`)
const iterator = finder.findByAst(ast, dir, caseSensitive)
```

这个查询会找到文件名以三个小写字母开头并且包含 Python 代码块的 Markdown 文件。

