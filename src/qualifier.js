import * as path_ from "path"
import { default as MarkdownIt } from "markdown-it"

class QualifierMixin {
    static OPERATOR = {
        ":": (a, b) => a.includes(b),
        "=": (a, b) => a === b,
        "!=": (a, b) => a !== b,
        ">=": (a, b) => a >= b,
        "<=": (a, b) => a <= b,
        ">": (a, b) => a > b,
        "<": (a, b) => a < b,
    }

    static OPERATOR_NAME = { ":": "包含", "=": "为", "!=": "不为", ">=": "大于等于", "<=": "小于等于", ">": "大于", "<": "小于" }

    static UNITS = { k: 1 << 10, m: 1 << 20, g: 1 << 30, kb: 1 << 10, mb: 1 << 20, gb: 1 << 30 }

    static VALIDATE = {
        isStringOrRegexp: (scope, operator, operand, operandType) => {
            if (operandType === "REGEXP") {
                if (operator !== ":") {
                    throw new Error(`In ${scope.toUpperCase()}: RegExp operands only support the ":" operator`)
                }
                try {
                    new RegExp(operand)
                } catch (e) {
                    throw new Error(`In ${scope.toUpperCase()}: Invalid regular expression: "${operand}"`)
                }
            }
            if (operator !== ":" && operator !== "=" && operator !== "!=") {
                throw new Error(`In ${scope.toUpperCase()}: Only supports "=", "!=", and ":" operators`)
            }
        },
        isComparable: (scope, operator, operand, operandType) => {
            if (operandType === "REGEXP") {
                throw new Error(`In ${scope.toUpperCase()}: RegExp operands are not valid for comparisons`)
            }
            if (operator === ":") {
                throw new Error(`In ${scope.toUpperCase()}: The ":" operator is not valid for comparisons`)
            }
        },
        isBoolean: (scope, operator, operand, operandType) => {
            if (operator !== "=" && operator !== "!=") {
                throw new Error(`In ${scope.toUpperCase()}: Only supports "=" and "!=" operators for logical comparisons`)
            }
            if (operandType === "REGEXP") {
                throw new Error(`In ${scope.toUpperCase()}: RegExp operands are not valid for logical comparisons`)
            }
            if (operand !== "true" && operand !== "false") {
                throw new Error(`In ${scope.toUpperCase()}: Operand must be "true" or "false"`)
            }
        },
        isSize: (scope, operator, operand, operandType) => {
            this.VALIDATE.isComparable(scope, operator, operand, operandType)
            const units = [...Object.keys(this.UNITS)].sort((a, b) => b.length - a.length).join("|")
            const ok = new RegExp(`^\\d+(\\.\\d+)?(${units})$`, "i").test(operand)
            if (!ok) {
                throw new Error(`In ${scope.toUpperCase()}: Operand must be a number followed by a unit: ${units}`)
            }
        },
        isNumber: (scope, operator, operand, operandType) => {
            this.VALIDATE.isComparable(scope, operator, operand, operandType)
            if (isNaN(operand)) {
                throw new Error(`In ${scope.toUpperCase()}: Operand must be a valid number`)
            }
        },
        isDate: (scope, operator, operand, operandType) => {
            this.VALIDATE.isComparable(scope, operator, operand, operandType)
            if (isNaN(new Date(operand).getTime())) {
                throw new Error(`In ${scope.toUpperCase()}: Operand must be a valid date string`)
            }
        },
    }

    static CAST = {
        toStringOrRegexp: (operand, operandType) => operandType === "REGEXP" ? new RegExp(operand) : operand.toString(),
        toNumber: operand => Number(operand),
        toBoolean: operand => operand.toLowerCase() === "true",
        toBytes: operand => {
            const units = [...Object.keys(this.UNITS)].sort((a, b) => b.length - a.length).join("|")
            const match = operand.match(/^(\d+(\.\d+)?)([a-z]+)$/i)
            if (!match) {
                throw new Error(`Operand must be a number followed by a unit: ${units}`)
            }
            const unit = match[3].toLowerCase()
            if (!this.UNITS.hasOwnProperty(unit)) {
                throw new Error(`Only supports unit: ${units}`)
            }
            return parseFloat(match[1]) * this.UNITS[unit]
        },
        toDate: operand => {
            operand = new Date(operand)
            operand.setHours(0, 0, 0, 0)
            return operand
        },
    }

    static MATCH = {
        primitiveCompare: (scope, operator, operand, queryResult) => this.OPERATOR[operator](queryResult, operand),
        stringRegexp: (scope, operator, operand, queryResult) => operand.test(queryResult.toString()),
        arrayCompare: (scope, operator, operand, queryResult) => queryResult.some(data => this.OPERATOR[operator](data, operand)),
        arrayRegexp: (scope, operator, operand, queryResult) => queryResult.some(data => operand.test(data)),
    }
}

/**
 * {string}   scope:         Qualifier scope
 * {string}   name:          Name for explain
 * {boolean}  is_meta:       Is Qualifier scope a metadata property
 * {function} validate:      Checks user input; defaults to `QualifierMixin.VALIDATE.isStringOrRegexp`
 * {function} cast:          Converts user input for easier matching; defaults to `QualifierMixin.CAST.toStringOrRegexp`
 * {function} query:         Retrieves data from source
 * {function} match_keyword: Matches castResult with queryResult when the user input is a keyword; defaults to `QualifierMixin.MATCH.compare`
 * {function} match_phrase:  Matches castResult with queryResult when the user input is a phrase; behaves the same as `match_keyword` by default
 * {function} match_regexp:  Matches castResult with queryResult when the user input is a regexp; defaults to `QualifierMixin.MATCH.regexp`
 */
const buildBaseQualifiers = () => {
    const QUERY = {
        default: ({ path, file, stats, data }) => `${data.toString()}\n${path}`,
        path: ({ path, file, stats, data }) => path,
        file: ({ path, file, stats, data }) => file,
        ext: ({ path, file, stats, data }) => path_.extname(file),
        content: ({ path, file, stats, data }) => data.toString(),
        time: ({ path, file, stats, data }) => QualifierMixin.CAST.toDate(stats.mtime),
        size: ({ path, file, stats, data }) => stats.size,
        linenum: ({ path, file, stats, data }) => data.toString().split("\n").length,
        charnum: ({ path, file, stats, data }) => data.toString().length,
        crlf: ({ path, file, stats, data }) => data.toString().includes("\r\n"),
        hasimage: ({ path, file, stats, data }) => /!\[.*?\]\(.*\)|<img.*?src=".*?"/.test(data.toString()),
        haschinese: ({ path, file, stats, data }) => /\p{sc=Han}/gu.test(data.toString()),
        line: ({ path, file, stats, data }) => data.toString().split("\n").map(e => e.trim()),
        chinesenum: ({ path, file, stats, data }) => {
            let count = 0
            for (const _ of data.toString().matchAll(/\p{sc=Han}/gu)) {
                count++
            }
            return count
        },
    }
    return [
        { scope: "default", name: "内容或路径", is_meta: false, query: QUERY.default },
        { scope: "path", name: "路径", is_meta: true, query: QUERY.path },
        { scope: "file", name: "文件名", is_meta: true, query: QUERY.file },
        { scope: "ext", name: "扩展名", is_meta: true, query: QUERY.ext },
        { scope: "content", name: "内容", is_meta: false, query: QUERY.content },
        { scope: "time", name: "修改时间", is_meta: true, query: QUERY.time, validate: QualifierMixin.VALIDATE.isDate, cast: QualifierMixin.CAST.toDate },
        { scope: "size", name: "文件大小", is_meta: true, query: QUERY.size, validate: QualifierMixin.VALIDATE.isSize, cast: QualifierMixin.CAST.toBytes },
        { scope: "linenum", name: "行数", is_meta: true, query: QUERY.linenum, validate: QualifierMixin.VALIDATE.isNumber, cast: QualifierMixin.CAST.toNumber },
        { scope: "charnum", name: "字符数", is_meta: true, query: QUERY.charnum, validate: QualifierMixin.VALIDATE.isNumber, cast: QualifierMixin.CAST.toNumber },
        { scope: "chinesenum", name: "中文字符数", is_meta: true, query: QUERY.chinesenum, validate: QualifierMixin.VALIDATE.isNumber, cast: QualifierMixin.CAST.toNumber },
        { scope: "crlf", name: "换行符为CRLF", is_meta: true, query: QUERY.crlf, validate: QualifierMixin.VALIDATE.isBoolean, cast: QualifierMixin.CAST.toBoolean },
        { scope: "hasimage", name: "包含图片", is_meta: true, query: QUERY.hasimage, validate: QualifierMixin.VALIDATE.isBoolean, cast: QualifierMixin.CAST.toBoolean },
        { scope: "haschinese", name: "包含中文字符", is_meta: true, query: QUERY.haschinese, validate: QualifierMixin.VALIDATE.isBoolean, cast: QualifierMixin.CAST.toBoolean },
        { scope: "line", name: "某行", is_meta: false, query: QUERY.line, match_keyword: QualifierMixin.MATCH.arrayCompare, match_regexp: QualifierMixin.MATCH.arrayRegexp },
    ]
}

const cache = fn => {
    let cached, result
    return arg => {
        if (arg !== cached) {
            result = fn(arg)
            cached = arg
        }
        return result
    }
}

const markdownit = new MarkdownIt({ html: true, linkify: true, typographer: true })

const PARSER = {
    block: cache((content, options = {}) => markdownit.parse(content, options)),
    inline: cache((content, options = {}) => markdownit.parseInline(content, options)),
}

const FILTER = {
    is: type => {
        return node => node.type === type
    },
    wrappedBy: type => {
        const openType = `${type}_open`
        const closeType = `${type}_close`
        let balance = 0
        return node => {
            if (node.type === openType) {
                balance++
            } else if (node.type === closeType) {
                balance--
            }
            return balance > 0
        }
    },
    wrappedByTag: (type, tag) => {
        const openType = `${type}_open`
        const closeType = `${type}_close`
        let balance = 0
        return node => {
            if (node.type === openType && node.tag === tag) {
                balance++
            } else if (node.type === closeType && node.tag === tag) {
                balance--
            }
            return balance > 0
        }
    },
    wrappedByMulti: (...types) => {
        let wrapped = false
        const balances = new Uint8Array(types.length).fill(0)
        const flags = new Map(types.flatMap((type, idx) => [
            [`${type}_open`, [idx, 1]],
            [`${type}_close`, [idx, -1]],
        ]))
        return node => {
            const hit = flags.get(node.type)
            if (hit) {
                const [idx, value] = hit
                balances[idx] += value
                balances.fill(0, idx + 1)
                wrapped = balances.every(val => val > 0)
            }
            return wrapped
        }
    }
}

const TRANSFORMER = {
    content: node => {
        return node.content
    },
    info: node => {
        return node.info
    },
    infoAndContent: node => {
        return `${node.info} ${node.content}`
    },
    attrAndContent: node => {
        const attrs = node.attrs || []
        const attrContent = attrs.map(l => l[l.length - 1]).join(" ")
        return `${attrContent}${node.content}`
    },
    regexpContent: regexp => {
        return node => {
            const content = node.content.trim()
            const result = [...content.matchAll(regexp)]
            return result.map(([_, text]) => text).join(" ")
        }
    },
    contentLine: node => {
        return node.content.split("\n")
    },
    taskContent: (selectType = 0) => {
        const regexp = /^\[(x|X| )\]\s+(.+)/
        return node => {
            const content = node.content.trim()
            const hit = content.match(regexp)
            if (!hit) return ""
            const [_, selectText, taskText] = hit
            // 0:both, 1:selected, -1:unselected
            switch (selectType) {
                case 0:
                    return taskText
                case 1:
                    return (selectText === "x" || selectText === "X") ? taskText : ""
                case -1:
                    return selectText === " " ? taskText : ""
                default:
                    return ""
            }
        }
    },
}

const buildMarkdownQualifiers = () => {
    const preorder = (ast = [], filter) => {
        const output = []
        const recurse = ast => {
            for (const node of ast) {
                if (filter(node)) {
                    output.push(node)
                }
                const children = node.children
                if (children && children.length) {
                    recurse(children)
                }
            }
        }
        recurse(ast)
        return output
    }
    const buildQuery = (parser, filter, transformer) => {
        return source => {
            const content = source.data.toString()
            const ast = parser(content)
            const nodes = preorder(ast, filter)
            return nodes.flatMap(transformer).filter(Boolean)
        }
    }
    const buildQualifier = (scope, name, parser, filter, transformer) => {
        const query = buildQuery(parser, filter, transformer)
        const is_meta = false
        const validate = QualifierMixin.VALIDATE.isStringOrRegexp
        const cast = QualifierMixin.CAST.toStringOrRegexp
        const match_keyword = QualifierMixin.MATCH.arrayCompare
        const match_phrase = match_keyword
        const match_regexp = QualifierMixin.MATCH.arrayRegexp
        return { scope, name, query, is_meta, validate, cast, match_keyword, match_phrase, match_regexp }
    }

    return [
        buildQualifier("blockcode", "代码块", PARSER.block, FILTER.is("fence"), TRANSFORMER.infoAndContent),
        buildQualifier("blockcodelang", "代码块语言", PARSER.block, FILTER.is("fence"), TRANSFORMER.info),
        buildQualifier("blockcodebody", "代码块内容", PARSER.block, FILTER.is("fence"), TRANSFORMER.content),
        buildQualifier("blockcodeline", "代码块的某行", PARSER.block, FILTER.is("fence"), TRANSFORMER.contentLine),
        buildQualifier("blockhtml", "HTML块", PARSER.block, FILTER.is("html_block"), TRANSFORMER.content),
        buildQualifier("blockquote", "引用块", PARSER.block, FILTER.wrappedBy("blockquote"), TRANSFORMER.content),
        buildQualifier("table", "表格", PARSER.block, FILTER.wrappedBy("table"), TRANSFORMER.content),
        buildQualifier("thead", "表格标题", PARSER.block, FILTER.wrappedBy("thead"), TRANSFORMER.content),
        buildQualifier("tbody", "表格正文", PARSER.block, FILTER.wrappedBy("tbody"), TRANSFORMER.content),
        buildQualifier("ol", "有序列表", PARSER.block, FILTER.wrappedBy("ordered_list"), TRANSFORMER.content),
        buildQualifier("ul", "无序列表", PARSER.block, FILTER.wrappedBy("bullet_list"), TRANSFORMER.content),
        buildQualifier("task", "任务列表", PARSER.block, FILTER.wrappedByMulti("bullet_list", "list_item", "paragraph"), TRANSFORMER.taskContent(0)),
        buildQualifier("taskdone", "已完成任务", PARSER.block, FILTER.wrappedByMulti("bullet_list", "list_item", "paragraph"), TRANSFORMER.taskContent(1)),
        buildQualifier("tasktodo", "未完成任务", PARSER.block, FILTER.wrappedByMulti("bullet_list", "list_item", "paragraph"), TRANSFORMER.taskContent(-1)),
        buildQualifier("head", "标题", PARSER.block, FILTER.wrappedBy("heading"), TRANSFORMER.content),
        buildQualifier("h1", "一级标题", PARSER.block, FILTER.wrappedByTag("heading", "h1"), TRANSFORMER.content),
        buildQualifier("h2", "二级标题", PARSER.block, FILTER.wrappedByTag("heading", "h2"), TRANSFORMER.content),
        buildQualifier("h3", "三级标题", PARSER.block, FILTER.wrappedByTag("heading", "h3"), TRANSFORMER.content),
        buildQualifier("h4", "四级标题", PARSER.block, FILTER.wrappedByTag("heading", "h4"), TRANSFORMER.content),
        buildQualifier("h5", "五级标题", PARSER.block, FILTER.wrappedByTag("heading", "h5"), TRANSFORMER.content),
        buildQualifier("h6", "六级标题", PARSER.block, FILTER.wrappedByTag("heading", "h6"), TRANSFORMER.content),
        buildQualifier("highlight", "高亮文字", PARSER.block, FILTER.is("text"), TRANSFORMER.regexpContent(/==(.+)==/g)),
        buildQualifier("image", "图片", PARSER.inline, FILTER.is("image"), TRANSFORMER.attrAndContent),
        buildQualifier("code", "代码", PARSER.inline, FILTER.is("code_inline"), TRANSFORMER.content),
        buildQualifier("link", "链接", PARSER.inline, FILTER.wrappedBy("link"), TRANSFORMER.attrAndContent),
        buildQualifier("strong", "加粗文字", PARSER.inline, FILTER.wrappedBy("strong"), TRANSFORMER.content),
        buildQualifier("em", "斜体文字", PARSER.inline, FILTER.wrappedBy("em"), TRANSFORMER.content),
        buildQualifier("del", "删除线文字", PARSER.inline, FILTER.wrappedBy("s"), TRANSFORMER.content),
    ]
}

const getDefaultQualifiers = () => {
    const all = [...buildBaseQualifiers(), ...buildMarkdownQualifiers()]
    all.forEach(q => {
        q.validate = q.validate || QualifierMixin.VALIDATE.isStringOrRegexp
        q.cast = q.cast || QualifierMixin.CAST.toStringOrRegexp
        q.KEYWORD = q.match_keyword || QualifierMixin.MATCH.primitiveCompare
        q.PHRASE = q.match_phrase || q.KEYWORD
        q.REGEXP = q.match_regexp || QualifierMixin.MATCH.stringRegexp
    })
    return all
}

export { QualifierMixin, PARSER as MarkdownParser, getDefaultQualifiers }
