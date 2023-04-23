const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')

module.exports = {
    mode: 'development',
    entry: {
      bundle: path.resolve(__dirname, 'src/index.js'),
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
    },
    devtool: 'source-map',
    devServer: {
        static: {
            directory: path.resolve(__dirname, 'dist'),
        },
        port: 3030,
        open: true,
        hot: true,
        compress: true
    },
    plugins: [
        new HtmlWebpackPlugin({
          title: 'Webpack App',
          filename: 'index.html',
          template: 'src/template.html'
        })
    ]
}
