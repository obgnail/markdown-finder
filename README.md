# Markdown Finder

English | [简体中文](https://github.com/obgnail/markdown-finder/blob/master/README.zh-CN.md)

Markdown Finder is a Node.js tool designed to search for Markdown files within a local directory. It supports complex grammar queries to precisely locate the required files.



## Features

- Supports complex grammar queries, including file path, file name, extension, size, time, line number, character count, and more.
- Supports regular expression queries.
- Supports querying through an Abstract Syntax Tree (AST).



## Usage Examples

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

// Get the query grammar
finder.getGrammar()

// Query by grammar
const iterator = finder.find("size>10kb | content:abc", dir, caseSensitive)

// Query by AST
const ast = finder.parse(`file:/[a-z]{3}/ blockcodelang:python`)
const iterator = finder.findByAst(ast, dir, caseSensitive)
```



## Grammar Explanation

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



## Example Explanations

### Grammar Query Example

```javascript
const iterator = finder.find("size>10kb | content:abc", dir, caseSensitive)
```

This query finds Markdown files that are larger than 10KB and contain the text "abc".



### Query by AST Example

```javascript
const ast = finder.parse(`file:/[a-z]{3}/ blockcodelang:python`)
const iterator = finder.findByAst(ast, dir, caseSensitive)
```

This query finds Markdown files that have a file name starting with three lowercase letters and contain a Python code block.