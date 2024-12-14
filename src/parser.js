const TYPE = {
    OR: "OR",
    AND: "AND",
    NOT: "NOT",
    PAREN_OPEN: "PAREN_OPEN",
    PAREN_CLOSE: "PAREN_CLOSE",
    KEYWORD: "KEYWORD",
    PHRASE: "PHRASE",
    REGEXP: "REGEXP",
    QUALIFIER: "QUALIFIER",
}

class Parser {
    static INVALID_POSITION = {
        FIRST: new Set([TYPE.OR, TYPE.AND, TYPE.PAREN_CLOSE]),
        LAST: new Set([TYPE.OR, TYPE.AND, TYPE.NOT, TYPE.PAREN_OPEN, TYPE.QUALIFIER]),
        FOLLOW: {
            [TYPE.OR]: new Set([TYPE.OR, TYPE.AND, TYPE.PAREN_CLOSE]),
            [TYPE.AND]: new Set([TYPE.OR, TYPE.AND, TYPE.PAREN_CLOSE]),
            [TYPE.NOT]: new Set([TYPE.OR, TYPE.AND, TYPE.NOT, TYPE.PAREN_CLOSE]),
            [TYPE.PAREN_OPEN]: new Set([TYPE.OR, TYPE.AND, TYPE.PAREN_CLOSE]),
            [TYPE.QUALIFIER]: new Set([TYPE.OR, TYPE.AND, TYPE.NOT, TYPE.PAREN_CLOSE, TYPE.QUALIFIER]),
        },
        AND: {
            PREV: new Set([TYPE.OR, TYPE.AND, TYPE.NOT, TYPE.PAREN_OPEN, TYPE.QUALIFIER]),
            NEXT: new Set([TYPE.OR, TYPE.AND, TYPE.NOT, TYPE.PAREN_CLOSE]),
        },
    }

    constructor(
        scope = ["default", "file", "path", "ext", "content", "time", "size"],
        operator = [">=", "<=", ":", "=", ">", "<"],
    ) {
        this.setQualifier(scope, operator)
    }

    setQualifier(scope, operator) {
        const byLength = (a, b) => b.length - a.length
        const _scope = [...scope].sort(byLength).join("|")
        const _operator = [...operator].sort(byLength).join("|")
        this.regex = new RegExp(
            [
                `(?<AND>(\\s|\\bAND\\b)+)`,
                `(?<NOT>-)`,
                `"(?<PHRASE>[^"]*)"`,
                `(?<PAREN_OPEN>\\()`,
                `(?<PAREN_CLOSE>\\))`,
                `(?<OR>\\||\\bOR\\b)`,
                `(?<QUALIFIER>(?<SCOPE>${_scope})(?<OPERATOR>${_operator}))`,
                `\\/(?<REGEXP>.*?)(?<!\\\\)\\/`,
                `(?<KEYWORD>[^\\s"()|]+)`,
            ].join("|"),
            "gi"
        )
    }

    tokenize(query) {
        return [...query.trim().matchAll(this.regex)]
            .map(_tokens => {
                const [qualifier, operand = ""] = Object.entries(_tokens.groups).find(([_, v]) => v != null)
                const type = TYPE[qualifier] || TYPE.KEYWORD
                return qualifier === TYPE.QUALIFIER
                    ? { type, scope: _tokens.groups.SCOPE, operator: _tokens.groups.OPERATOR }
                    : { type, operand }
            })
            .filter((token, i, tokens) => {
                if (token.type !== TYPE.AND) return true
                const prev = tokens[i - 1]
                const next = tokens[i + 1]
                let result = true
                if (prev) {
                    result = result && !Parser.INVALID_POSITION.AND.PREV.has(prev.type)
                }
                if (next) {
                    result = result && !Parser.INVALID_POSITION.AND.NEXT.has(next.type)
                }
                return result
            })
    }

    check(tokens) {
        // check first
        const first = tokens[0]
        if (Parser.INVALID_POSITION.FIRST.has(first.type)) {
            throw new Error(`Invalid first token:「${first.type}」`)
        }

        // check last
        const last = tokens[tokens.length - 1]
        if (Parser.INVALID_POSITION.LAST.has(last.type)) {
            throw new Error(`Invalid last token:「${last.type}」`)
        }

        // check follow
        tokens.slice(0, -1).forEach((token, i) => {
            const set = Parser.INVALID_POSITION.FOLLOW[token.type]
            const follow = tokens[i + 1]
            if (set && set.has(follow.type)) {
                throw new Error(`Invalid token sequence:「${token.type}」followed by「${follow.type}」`)
            }
        })

        // check parentheses
        let balance = 0
        tokens.forEach(token => {
            if (token.type === TYPE.PAREN_OPEN) {
                balance++
            } else if (token.type === TYPE.PAREN_CLOSE) {
                balance--
                if (balance < 0) {
                    throw new Error(`Unmatched「${TYPE.PAREN_CLOSE}」`)
                }
            }
        })
        if (balance !== 0) {
            throw new Error(`Unmatched「${TYPE.PAREN_OPEN}」`)
        }
    }

    _parseExpression(tokens) {
        let node = this._parseTerm(tokens)
        while (tokens.length > 0) {
            const type = tokens[0].type
            if (type === TYPE.OR) {
                tokens.shift()
                const right = this._parseTerm(tokens)
                node = { type, left: node, right }
            } else {
                break
            }
        }
        return node
    }

    _parseTerm(tokens) {
        let node = this._parseFactor(tokens)
        while (tokens.length > 0) {
            const type = tokens[0].type
            if (type === TYPE.NOT || type === TYPE.AND) {
                tokens.shift()
                const right = this._parseFactor(tokens)
                node = { type, left: node, right }
            } else {
                break
            }
        }
        return node
    }

    _parseFactor(tokens) {
        const qualifier = (tokens[0].type === TYPE.QUALIFIER)
            ? tokens.shift()
            : { type: TYPE.QUALIFIER, scope: "default", operator: ":" }
        const node = this._parseMatch(tokens)
        return this._setQualifier(node, qualifier)
    }

    _parseMatch(tokens) {
        const type = tokens[0].type
        if (type === TYPE.PHRASE || type === TYPE.KEYWORD || type === TYPE.REGEXP) {
            return { type, operand: tokens.shift().operand }
        } else if (type === TYPE.PAREN_OPEN) {
            tokens.shift()
            const node = this._parseExpression(tokens)
            if (tokens.shift().type !== TYPE.PAREN_CLOSE) {
                throw new Error(`Unmatched「${TYPE.PAREN_OPEN}」`)
            }
            return node
        }
    }

    _setQualifier(node, qualifier) {
        if (!node) return
        const type = node.type
        const isLeaf = type === TYPE.PHRASE || type === TYPE.KEYWORD || type === TYPE.REGEXP
        const isDefault = !node.scope || node.scope === "default"
        if (isLeaf && isDefault) {
            node.scope = qualifier.scope
            node.operator = qualifier.operator
        } else {
            this._setQualifier(node.left, qualifier)
            this._setQualifier(node.right, qualifier)
        }
        return node
    }

    parse(query) {
        query = query.trim()
        const tokens = this.tokenize(query)
        if (tokens.length === 0) {
            throw new Error(`Parse error. Empty tokens`)
        }
        this.check(tokens)
        const ast = this._parseExpression(tokens)
        if (tokens.length !== 0) {
            throw new Error(`Parse error. Failed to parse tokens: ${tokens.join(" ")}`)
        }
        return ast
    }

    evaluate(ast, callback) {
        const { KEYWORD, PHRASE, REGEXP, OR, AND, NOT } = TYPE

        function _eval(node) {
            const { type, left, right } = node
            switch (type) {
                case KEYWORD:
                case PHRASE:
                case REGEXP:
                    return callback(node)
                case OR:
                    return _eval(left) || _eval(right)
                case AND:
                    return _eval(left) && _eval(right)
                case NOT:
                    return (left ? _eval(left) : true) && !_eval(right)
                default:
                    throw new Error(`Unknown AST node「${type}」`)
            }
        }

        return _eval(ast)
    }

    traverse(ast, callback) {
        const { KEYWORD, PHRASE, REGEXP, OR, AND, NOT } = TYPE

        function _eval(node) {
            const { type, left, right } = node
            switch (type) {
                case KEYWORD:
                case PHRASE:
                case REGEXP:
                    callback(node)
                    break
                case OR:
                case AND:
                    _eval(left)
                    _eval(right)
                    break
                case NOT:
                    left && _eval(left)
                    _eval(right)
                    break
                default:
                    throw new Error(`Unknown AST node「${type}」`)
            }
        }

        return _eval(ast)
    }
}

export { Parser, TYPE as TokenType }
