const Koa = require('koa');
const gzip = require('koa-gzip');
const koaStatic = require('koa-static');
const path = require('path');

const app = new Koa();
app.use(koaStatic(path.join(__dirname, 'out')));

app.listen(8000, () => {
  console.log('Listening on 8000');
});