const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const { GenerateSW } = require('workbox-webpack-plugin');

/** @type {import('webpack').Configuration} */
module.exports = (_env, argv) => ({
  entry: './src/index.tsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.[contenthash].js',
    publicPath: '/',
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: 'ts-loader',
          options: {
            configFile: 'tsconfig.webpack.json',
          },
        },
        exclude: /node_modules/,
      },
      {
        test: /\.less$/,
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: {
              modules: {
                auto: /\.module\.less$/,
                localIdentName: '[name]__[local]--[hash:base64:5]',
                namedExport: false,
              },
            },
          },
          'less-loader',
        ],
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(png|jpg|gif|svg|ico)$/,
        type: 'asset/resource',
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html',
      title: 'Chat',
      favicon: './public/favicon.png',
    }),
    // 复制 PWA 资源到 dist 目录
    new CopyPlugin({
      patterns: [
        { from: 'public/manifest.json', to: 'manifest.json' },
        { from: 'public/icons', to: 'icons' },
      ],
    }),
    // Workbox：生成 Service Worker（仅生产模式）
    ...(argv.mode === 'production'
      ? [
          new GenerateSW({
            clientsClaim: true,
            skipWaiting: false,
            navigateFallback: '/index.html',
            navigateFallbackDenylist: [/^\/api/, /^\/socket\.io/, /^\/uploads/],
            runtimeCaching: [
              {
                urlPattern: /\.(?:js|css)$/,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'static-assets',
                  expiration: { maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 },
                },
              },
              {
                urlPattern: /\.(?:png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot)$/,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'images-fonts',
                  expiration: { maxEntries: 100, maxAgeSeconds: 60 * 24 * 60 * 60 },
                },
              },
            ],
            exclude: [/\.map$/, /^manifest.*\.js$/],
          }),
        ]
      : []),
  ],
  devServer: {
    port: 3000,
    hot: true,
    historyApiFallback: true,
    proxy: [
      {
        context: ['/api', '/socket.io', '/uploads'],
        target: 'http://localhost:3001',
        ws: true,
      },
    ],
  },
});
