module.exports = {
	entry: "./src/app.js",
	output: {
		filename: "./build/bundle.js"
	},
	module: {
		loaders: [
			{
				exclude: /node_modules/,
				loader: 'babel-loader'
			}
		]
	},
	resolve: {
		extensions: ['', '.js']
	}
}
