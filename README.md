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

| Example                                                      | Searches for documents where...                              |
| :----------------------------------------------------------- | :----------------------------------------------------------- |
| pear                                                         | ...the content contains "pear". (Equivalent to `default:pear`) |
| sour pear                                                    | ...the content contains both "sour" and "pear". (Equivalent to `sour AND pear`) |
| sour \| pear                                                 | ...the content contains "sour" OR "pear". (Equivalent to `sour OR pear`) |
| "sour pear"                                                  | ...the content contains the exact phrase "sour pear".        |
| sour pear -apple                                             | ...the content contains both "sour" and "pear", but does NOT contain "apple". |
| /\bsour\b/ pear time=2024-03-12                              | ...the content contains the word "sour" (whole-word match), also contains "pear", and the file was last modified on 2024-03-12. |
| head=plugin \| strong:MIT                                    | ...the heading contains the word "head", AND the text marked as strong contains “MIT” |
| size>10k (linenum>=1000 \| hasimage=true)                    | …the file size is greater than 10KB, AND the file either has at least 1000 lines or contains images. |
| path:(info \| warn \| err) -ext:md                           | …the file path contains 'info', 'warn', or 'err', AND the file extension does not contain 'md' |
| file:/[a-z]{3}/ content:prometheus blockcode:"kubectl apply" | ...the file name matches the regular expression `/[a-z]{3}/`, AND the content contains "prometheus", AND a code block contains the phrase "kubectl apply". |

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

### Grammar Query Example

```javascript
const iterator = finder.find("size>10kb | content:abc", dir, caseSensitive)
```

This query finds Markdown files that are larger than 10KB OR contain the text "abc".



### Query by AST Example

```javascript
const ast = finder.parse(`file:/[a-z]{3}/ blockcodelang:python`)
const iterator = finder.findByAst(ast, dir, caseSensitive)
```

This query finds Markdown files that have a file name starting with three lowercase letters and contain a Python code block.

