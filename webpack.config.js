module.exports = {
	entry: "./src/app.js",
	output: {
		filename: "./build/bundle.js"
	},
	module: {
		preLoaders: [
	      {
	        test: /\.js$/,
	        loader: 'eslint-loader',
			exclude: /node_modules/
	      }
	   ],
		loaders: [
			{
				test: /\.js$/,
				exclude: /node_modules/,
				loader: 'babel-loader'
			}
		]
	},
	resolve: {
		extensions: ['', '.js']
	}
}
