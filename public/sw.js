if(!self.define){let e,s={};const a=(a,i)=>(a=new URL(a+".js",i).href,s[a]||new Promise((s=>{if("document"in self){const e=document.createElement("script");e.src=a,e.onload=s,document.head.appendChild(e)}else e=a,importScripts(a),s()})).then((()=>{let e=s[a];if(!e)throw new Error(`Module ${a} didn’t register its module`);return e})));self.define=(i,n)=>{const c=e||("document"in self?document.currentScript.src:"")||location.href;if(s[c])return;let t={};const r=e=>a(e,c),o={module:{uri:c},exports:t,require:r};s[c]=Promise.all(i.map((e=>o[e]||r(e)))).then((e=>(n(...e),t)))}}define(["./workbox-50de5c5d"],(function(e){"use strict";importScripts(),self.skipWaiting(),e.clientsClaim(),e.precacheAndRoute([{url:"/_next/static/chunks/482-8117dd335215f048.js",revision:"8117dd335215f048"},{url:"/_next/static/chunks/895-c005e24ca6513d80.js",revision:"c005e24ca6513d80"},{url:"/_next/static/chunks/framework-63157d71ad419e09.js",revision:"63157d71ad419e09"},{url:"/_next/static/chunks/main-7c9ede246e0d12e7.js",revision:"7c9ede246e0d12e7"},{url:"/_next/static/chunks/pages/404-a41f9e5cdf11c0fa.js",revision:"a41f9e5cdf11c0fa"},{url:"/_next/static/chunks/pages/_app-5772a6199ed6ee80.js",revision:"5772a6199ed6ee80"},{url:"/_next/static/chunks/pages/_error-54de1933a164a1ff.js",revision:"54de1933a164a1ff"},{url:"/_next/static/chunks/pages/about-587a8f46a72aa7d8.js",revision:"587a8f46a72aa7d8"},{url:"/_next/static/chunks/pages/index-dfc7c060d3409887.js",revision:"dfc7c060d3409887"},{url:"/_next/static/chunks/pages/withoutii-9fada448caeb1247.js",revision:"9fada448caeb1247"},{url:"/_next/static/chunks/polyfills-78c92fac7aa8fdd8.js",revision:"79330112775102f91e1010318bae2bd3"},{url:"/_next/static/chunks/webpack-f82f1876f5092192.js",revision:"f82f1876f5092192"},{url:"/_next/static/css/85fee67ca9c5b1fe.css",revision:"85fee67ca9c5b1fe"},{url:"/_next/static/m4K9iTQIGiLo11xT1Rxj8/_buildManifest.js",revision:"5a2536c6063a4e1e72ce28ceb344e747"},{url:"/_next/static/m4K9iTQIGiLo11xT1Rxj8/_ssgManifest.js",revision:"b6652df95db52feb4daf4eca35380933"},{url:"/_next/static/media/17ab47d1061e95cd-s.woff2",revision:"467da71d6f42aeef23653370ddd43ebc"},{url:"/_next/static/media/94c849382f2982dd-s.woff2",revision:"e7aa2b4934cc9eda396664aef2d45c33"},{url:"/_next/static/media/a504dbe723ca36b7-s.p.woff2",revision:"363e6c16646a07cfcb93b6d757d40c74"},{url:"/_next/static/wasm/c69bff202e996587.wasm",revision:"m4K9iTQIGiLo11xT1Rxj8"},{url:"/android-chrome-192x192.png",revision:"aeaea89660ba341fd0d0e9f7b74527ba"},{url:"/android-chrome-512x512.png",revision:"835bef1ea78dfdf3647336248257541d"},{url:"/apple-touch-icon.png",revision:"14ffd9e84e0d075a042a5f7a84e4e755"},{url:"/browserconfig.xml",revision:"a493ba0aa0b8ec8068d786d7248bb92c"},{url:"/favicon-16x16.png",revision:"0e747c0e01f3b16d8508237e701d25b4"},{url:"/favicon-32x32.png",revision:"b161215025938e13913baf414ad1e2b3"},{url:"/favicon.ico",revision:"b67f99ae24aa24002ff2edd1b02ba79d"},{url:"/icp-logo.svg",revision:"620f8f9811357cdda4039ee8fedecf0c"},{url:"/icp.svg",revision:"7bafbb357010b36db4292707973c5329"},{url:"/logo.svg",revision:"c138a83dcb4da614f1a0a99a695c2500"},{url:"/mstile-144x144.png",revision:"6839a37bc44ecf7f6a644b52ef3c4d66"},{url:"/mstile-150x150.png",revision:"35ef7bfadd9e816fa5b2348a7be1d3ef"},{url:"/mstile-310x150.png",revision:"78f9cd0b49d4fe4b1ff01c3b5d4526c3"},{url:"/mstile-310x310.png",revision:"2183a481b9e6c2f0180db213a5676cd7"},{url:"/mstile-70x70.png",revision:"a56ea9cf013bce038fb77eca2fb51438"},{url:"/safari-pinned-tab.svg",revision:"ce17795de3bf4f9d8c119a93c868f9b4"},{url:"/site.webmanifest",revision:"f7839375a128e8b7317ccabf2664c079"}],{ignoreURLParametersMatching:[]}),e.cleanupOutdatedCaches(),e.registerRoute("/",new e.NetworkFirst({cacheName:"start-url",plugins:[{cacheWillUpdate:async({request:e,response:s,event:a,state:i})=>s&&"opaqueredirect"===s.type?new Response(s.body,{status:200,statusText:"OK",headers:s.headers}):s}]}),"GET"),e.registerRoute(/^https:\/\/fonts\.(?:gstatic)\.com\/.*/i,new e.CacheFirst({cacheName:"google-fonts-webfonts",plugins:[new e.ExpirationPlugin({maxEntries:4,maxAgeSeconds:31536e3})]}),"GET"),e.registerRoute(/^https:\/\/fonts\.(?:googleapis)\.com\/.*/i,new e.StaleWhileRevalidate({cacheName:"google-fonts-stylesheets",plugins:[new e.ExpirationPlugin({maxEntries:4,maxAgeSeconds:604800})]}),"GET"),e.registerRoute(/\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,new e.StaleWhileRevalidate({cacheName:"static-font-assets",plugins:[new e.ExpirationPlugin({maxEntries:4,maxAgeSeconds:604800})]}),"GET"),e.registerRoute(/\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,new e.StaleWhileRevalidate({cacheName:"static-image-assets",plugins:[new e.ExpirationPlugin({maxEntries:64,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(/\/_next\/image\?url=.+$/i,new e.StaleWhileRevalidate({cacheName:"next-image",plugins:[new e.ExpirationPlugin({maxEntries:64,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(/\.(?:mp3|wav|ogg)$/i,new e.CacheFirst({cacheName:"static-audio-assets",plugins:[new e.RangeRequestsPlugin,new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(/\.(?:mp4)$/i,new e.CacheFirst({cacheName:"static-video-assets",plugins:[new e.RangeRequestsPlugin,new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(/\.(?:js)$/i,new e.StaleWhileRevalidate({cacheName:"static-js-assets",plugins:[new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(/\.(?:css|less)$/i,new e.StaleWhileRevalidate({cacheName:"static-style-assets",plugins:[new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(/\/_next\/data\/.+\/.+\.json$/i,new e.StaleWhileRevalidate({cacheName:"next-data",plugins:[new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(/\.(?:json|xml|csv)$/i,new e.NetworkFirst({cacheName:"static-data-assets",plugins:[new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:86400})]}),"GET"),e.registerRoute((({url:e})=>{if(!(self.origin===e.origin))return!1;const s=e.pathname;return!s.startsWith("/api/auth/")&&!!s.startsWith("/api/")}),new e.NetworkFirst({cacheName:"apis",networkTimeoutSeconds:10,plugins:[new e.ExpirationPlugin({maxEntries:16,maxAgeSeconds:86400})]}),"GET"),e.registerRoute((({url:e})=>{if(!(self.origin===e.origin))return!1;return!e.pathname.startsWith("/api/")}),new e.NetworkFirst({cacheName:"others",networkTimeoutSeconds:10,plugins:[new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:86400})]}),"GET"),e.registerRoute((({url:e})=>!(self.origin===e.origin)),new e.NetworkFirst({cacheName:"cross-origin",networkTimeoutSeconds:10,plugins:[new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:3600})]}),"GET")}));
