# Rendering SDFs to SVG

## GitHub noreply email
```
git config user.name "a-johanson"
git config user.email "a-johanson@users.noreply.github.com"
```

## GitHub tokens
```
git remote add origin https://a-johanson:<TOKEN>@github.com/a-johanson/sdf-renderer.git
git push -u origin master
```

## Installing Node
```
nvm install node
nvm use node
```

## NPM with Webpack
```
npm init
npm install -D webpack webpack-cli webpack-dev-server html-webpack-plugin
npm install @svgdotjs/svg.js gl-matrix seedrandom
npm run build
npm run dev
```
