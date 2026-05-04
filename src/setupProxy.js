const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function setupProxy(app) {
  app.use(
    '/svc-posts',
    createProxyMiddleware({
      target: 'http://localhost:8082',
      changeOrigin: true,
      pathRewrite: { '^/svc-posts': '' }
    })
  );

  app.use(
    '/svc-media',
    createProxyMiddleware({
      target: 'http://localhost:8087',
      changeOrigin: true,
      pathRewrite: { '^/svc-media': '' }
    })
  );

  app.use(
    '/svc-comments',
    createProxyMiddleware({
      target: 'http://localhost:8083',
      changeOrigin: true,
      pathRewrite: { '^/svc-comments': '' }
    })
  );

  app.use(
    '/svc-likes',
    createProxyMiddleware({
      target: 'http://localhost:8084',
      changeOrigin: true,
      pathRewrite: { '^/svc-likes': '' }
    })
  );

  app.use(
    '/svc-follows',
    createProxyMiddleware({
      target: 'http://localhost:8085',
      changeOrigin: true,
      pathRewrite: { '^/svc-follows': '' }
    })
  );

  app.use(
    '/svc-notifications',
    createProxyMiddleware({
      target: 'http://localhost:8086',
      changeOrigin: true,
      pathRewrite: { '^/svc-notifications': '' }
    })
  );

  app.use(
    '/svc-search',
    createProxyMiddleware({
      target: 'http://localhost:8088',
      changeOrigin: true,
      pathRewrite: { '^/svc-search': '' }
    })
  );

  app.use(
    '/media/files',
    createProxyMiddleware({
      target: 'http://localhost:8087',
      changeOrigin: true
    })
  );
};
