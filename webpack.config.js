const path = require('path')

module.exports = {
    entry: "./src/index.ts",
    output: {
        path: path.resolve(__dirname, "dist"),
        filename: "markdown-find.js",
        libraryTarget: 'commonjs2',
    },
    target: "node",
    resolve: {
        extensions: [".ts", ".js"],
        fallback: {
            path: require.resolve("path-browserify"),
        }
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: 'ts-loader',
                exclude: /node_modules/
            }
        ]
    },
}