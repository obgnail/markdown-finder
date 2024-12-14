import * as fs from "fs"
import * as path from "path"

const Filter = {
    hidden: () => {
        return (file) => !file.startsWith(".")
    },
    size: (max = 10 * (1 << 20)) => {
        return (file, path, stats) => stats.size < max
    },
    ext: (allow = ["", "md", "markdown", "mdown", "mmd", "text", "txt", "rmarkdown", "mkd", "mdwn", "mdtxt", "rmd", "mdtext", "apib"]) => {
        const allowed = new Set(allow.map(ext => ext.toLowerCase()))
        return (file) => {
            const ext = path.extname(file).toLowerCase()
            const extension = ext.startsWith(".") ? ext.slice(1) : ext
            return allowed.has(extension)
        }
    },
    name: (exclude = [".git", "node_modules"]) => {
        return (file) => !exclude.includes(file)
    },
}

async function* genTraverser(
    dir,
    fileFilters = [Filter.hidden(), Filter.size(), Filter.ext()],
    dirFilters = [Filter.hidden(), Filter.name()],
) {
    const { join } = path
    const { readdir, stat, readFile } = fs.promises

    async function* traverse(dir) {
        const files = await readdir(dir)
        for (const file of files) {
            const path = join(dir, file)
            const stats = await stat(path)
            if (stats.isFile()) {
                if (fileFilters.every(fn => fn(file, path, stats))) {
                    const data = await readFile(path)
                    yield { path, file, stats, data }
                }
            } else if (stats.isDirectory()) {
                if (dirFilters.every(fn => fn(file, path))) {
                    yield* traverse(path)
                }
            }
        }
    }

    yield* traverse(dir)
}

export { genTraverser, Filter }