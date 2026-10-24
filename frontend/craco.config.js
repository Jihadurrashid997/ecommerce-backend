module.exports = {
    webpack: {
        configure: webpackConfig => {
            webpackConfig.resolve.fallback = {
                ...webpackConfig.resolve.fallback,
                crypto: false,
                fs: false,
                path: false
            };
            return webpackConfig;
        }
    }
};
