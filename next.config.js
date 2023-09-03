const packageJson = require("./package.json")
const withPWA = require("next-pwa")({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
})
const CopyPlugin = require("copy-webpack-plugin")
const webpack = require("webpack")

// load env from ../.env file
const envList = require("dotenv").config({ path: ".env" }).parsed
// get version from package.json
const { version } = require("./package.json")

console.log("version", version)

envList.NEXT_PUBLIC_IC_HOST =
  envList.DFX_NETWORK === "ic" ? "https://ic0.app" : "http://localhost:8080"

console.log("network", envList.DFX_NETWORK)

envList.NEXT_PUBLIC_VERSION = version

const rewriteConfig =
  process.env.NODE_ENV === "development"
    ? {
        async rewrites() {
          return [
            {
              source: "/api/:path*",
              destination: "http://localhost:8080/api/:path*",
            },
          ]
        },
      }
    : {
        output: "export",
      }

/** @type {import('next').NextConfig} */
module.exports = withPWA({
  env: {
    APP_VERSION: packageJson.version,
  },
  experimental: { esmExternals: true },
  ...rewriteConfig,
  webpack: (config) => {
    config.experiments = {
      asyncWebAssembly: true,
    }
    config.plugins = [
      ...config.plugins,
      new webpack.EnvironmentPlugin(envList),
      new CopyPlugin({
        patterns: [
          {
            from: "node_modules/vetkd-utils/ic_vetkd_utils_bg.wasm",
            to: "server/static/wasm/c69bff202e996587.wasm",
          },
        ],
      }),
    ]
    return config
  },
  reactStrictMode: false,
})
