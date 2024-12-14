import { deepEqual } from "assert"
import { Parser } from "../src/parser.js"

const defaultParser = new Parser()

function tokenizeDeepEqual(input, target) {
    const result = defaultParser.tokenize(input)
    deepEqual(result, target)
}

function parseDeepEqual(input, target) {
    const result = defaultParser.parse(input)
    deepEqual(result, target)
}

describe('Tokenize', function () {
    describe('base', function () {
        it('should tokenize KEYWORD', function () {
            tokenizeDeepEqual("abc", [{ operand: 'abc', type: 'KEYWORD' }])
        })
        it("should tokenize space", function () {
            tokenizeDeepEqual("abc def", [
                { operand: 'abc', type: 'KEYWORD' },
                { operand: ' ', type: 'AND' },
                { operand: 'def', type: 'KEYWORD' }
            ])
        })
        it("should tokenize AND", function () {
            tokenizeDeepEqual("abc AND def", [
                { operand: 'abc', type: 'KEYWORD' },
                { operand: ' AND ', type: 'AND' },
                { operand: 'def', type: 'KEYWORD' }
            ])
        })
        it("should tokenize OR", function () {
            tokenizeDeepEqual("abc OR 123", [
                { operand: 'abc', type: 'KEYWORD' },
                { operand: 'OR', type: 'OR' },
                { operand: '123', type: 'KEYWORD' }
            ])
        })
        it("should tokenize |", function () {
            tokenizeDeepEqual("abc | 123", [
                { operand: 'abc', type: 'KEYWORD' },
                { operand: '|', type: 'OR' },
                { operand: '123', type: 'KEYWORD' }
            ])
        })
        it("should tokenize NOT", function () {
            tokenizeDeepEqual("-123", [
                { operand: '-', type: 'NOT' },
                { operand: '123', type: 'KEYWORD' },
            ])
        })
        it("should tokenize PHRASE", function () {
            tokenizeDeepEqual('"999"', [{ operand: '999', type: 'PHRASE' }])
        })
        it("should tokenize PAREN", function () {
            tokenizeDeepEqual('(123)', [
                { operand: '(', type: 'PAREN_OPEN' },
                { operand: '123', type: 'KEYWORD' },
                { operand: ')', type: 'PAREN_CLOSE' }
            ])
        })
        it("should tokenize default qualifier", function () {
            tokenizeDeepEqual("default:default", [
                { operator: ':', scope: 'default', type: 'QUALIFIER' },
                { operand: 'default', type: 'KEYWORD' }
            ])
        })
        it("should tokenize file qualifier", function () {
            tokenizeDeepEqual("file:zxc", [
                { operator: ':', scope: 'file', type: 'QUALIFIER' },
                { operand: 'zxc', type: 'KEYWORD' }
            ])
        })
        it("should tokenize file REGEXP", function () {
            tokenizeDeepEqual("/\\d+/", [{ operand: '\\d+', type: 'REGEXP' }])
        })
    })
    describe('AND NOT OR', function () {
        it("should allow extra spaces", function () {
            tokenizeDeepEqual("   path:ccc   /123/  ", [
                { operator: ':', scope: 'path', type: 'QUALIFIER' },
                { operand: 'ccc', type: 'KEYWORD' },
                { operand: '   ', type: 'AND' },
                { operand: '123', type: 'REGEXP' }
            ])
        })
        it('should allow "AND"', function () {
            tokenizeDeepEqual("   path AND file  ", [
                { operand: 'path', type: 'KEYWORD' },
                { operand: ' AND ', type: 'AND' },
                { operand: 'file', type: 'KEYWORD' }
            ])
        })
        it("should allow neat NOT", function () {
            tokenizeDeepEqual("-(abc file:123)", [
                { operand: '-', type: 'NOT' },
                { operand: '(', type: 'PAREN_OPEN' },
                { operand: 'abc', type: 'KEYWORD' },
                { operand: ' ', type: 'AND' },
                { operator: ':', scope: 'file', type: 'QUALIFIER' },
                { operand: '123', type: 'KEYWORD' },
                { operand: ')', type: 'PAREN_CLOSE' }
            ])
        })
    })
})

describe('Parser', function () {
    describe('base', function () {
        it('single', function () {
            parseDeepEqual("abc", {
                operand: 'abc',
                operator: ':',
                scope: 'default',
                type: 'KEYWORD'
            })
        })
        it('default single', function () {
            parseDeepEqual("default:abc", {
                operand: 'abc',
                operator: ':',
                scope: 'default',
                type: 'KEYWORD'
            })
        })
        it('and', function () {
            parseDeepEqual("default:abc and 123", {
                left: {
                    operand: 'abc',
                    operator: ':',
                    scope: 'default',
                    type: 'KEYWORD'
                },
                right: {
                    operand: '123',
                    operator: ':',
                    scope: 'default',
                    type: 'KEYWORD'
                },
                type: 'AND'
            })
        })
        it('or', function () {
            parseDeepEqual("default:abc | 123", {
                left: {
                    operand: 'abc',
                    operator: ':',
                    scope: 'default',
                    type: 'KEYWORD'
                },
                right: {
                    operand: '123',
                    operator: ':',
                    scope: 'default',
                    type: 'KEYWORD'
                },
                type: 'OR'
            })
        })
        it('not single', function () {
            parseDeepEqual("-abc", {
                left: undefined,
                right: {
                    operand: 'abc',
                    operator: ':',
                    scope: 'default',
                    type: 'KEYWORD'
                },
                type: 'NOT'
            })
        })
        it('not', function () {
            parseDeepEqual("123 -abc", {
                left: {
                    operand: '123',
                    operator: ':',
                    scope: 'default',
                    type: 'KEYWORD'
                },
                right: {
                    operand: 'abc',
                    operator: ':',
                    scope: 'default',
                    type: 'KEYWORD'
                },
                type: 'NOT'
            })
        })
    })
    describe('mixed', function () {
        it("mixed AND NOT", function () {
            parseDeepEqual("sour pear -apple", {
                left: {
                    left: { operand: 'sour', operator: ':', scope: 'default', type: 'KEYWORD' },
                    right: { operand: 'pear', operator: ':', scope: 'default', type: 'KEYWORD' },
                    type: 'AND'
                },
                right: { operand: 'apple', operator: ':', scope: 'default', type: 'KEYWORD' },
                type: 'NOT'
            })
        })
        it("mixed Regex", function () {
            parseDeepEqual(`/\\bsour\\b/ pear time=2024-03-12`,{
                left: {
                    left: { operand: '\\bsour\\b', operator: ':', scope: 'default', type: 'REGEXP' },
                    right: { operand: 'pear', operator: ':', scope: 'default', type: 'KEYWORD' },
                    type: 'AND'
                },
                right: { operand: '2024-03-12', operator: '=', scope: 'time', type: 'KEYWORD' },
                type: 'AND'
            })
        })
        it("mixed OR", function () {
            parseDeepEqual(`开发 | content=plugin | size>2kb`,{
                left: {
                    left: { operand: '开发', operator: ':', scope: 'default', type: 'KEYWORD' },
                    right: { operand: 'plugin', operator: '=', scope: 'content', type: 'KEYWORD' },
                    type: 'OR'
                },
                right: { operand: '2kb', operator: '>', scope: 'size', type: 'KEYWORD' },
                type: 'OR'
            })
        })
        it("mixed PAREN", function () {
            parseDeepEqual(`path:(info | warn) -ext:md`,{
                left: {
                    left: { operand: 'info', operator: ':', scope: 'path', type: 'KEYWORD' },
                    right: { operand: 'warn', operator: ':', scope: 'path', type: 'KEYWORD' },
                    type: 'OR'
                },
                right: { operand: 'md', operator: ':', scope: 'ext', type: 'KEYWORD' },
                type: 'NOT'
            })
        })
    })
})