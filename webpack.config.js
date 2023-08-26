const HtmlWebpackPlugin = require("html-webpack-plugin")
const TsconfigPathsPlugin = require("tsconfig-paths-webpack-plugin")
const path = require("path")

module.exports = {
  mode: "development",
  entry: "./src/index.tsx",
  output: {
    filename: "index.js",
    path: path.resolve(__dirname, "dist"),
  },
  resolve: {
    plugins: [new TsconfigPathsPlugin({ configFile: "./tsconfig.json" })],
    // this is required for the extensions that you are using
    extensions: [".ts", ".tsx", ".js", ".jsx"],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: "public/index.html", // path to your index.html
    }),
  ],
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  devServer: {
    static: {
      directory: path.join(__dirname, "dist"),
    },
    compress: true,
    port: 9000,
  },
}
