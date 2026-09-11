# Tutorial on adding avatars to websites like in https://roavatar.net without CORS errors

## 1. Clone the RoAvatar and RoAvatar-Renderer from GitHub
### 0. Preqrequesits
- Install Node.js and npm (guide)
- Install Git (guide)
### 1. Cloning RoAvatar
- Create a directory for RoAvatar
- Run ```git clone --recursive https://github.com/steinann/RoAvatar.git```
- If you are missing submodules, run ```git submodule update --init```
- Run ```npm install``` in the project directory
### 2. Building RoAvatar-Renderer (only needed if the npm pakage wont work due to being outdated)
- Create a directory for RoAvatar-Renderer
- Run ```git clone --recursive https://github.com/steinann/RoAvatar-Renderer.git```
- If you are missing submodules, run ```git submodule update --init```
- Run ```npm install``` in the project directory
- Run ```npm run build```
- Run ```npm link```
### 3. Building specific version of RoAvatar with asset downloading
- Go to the directory you made for RoAvatar
#### Skip if you didnt build RoAvatar-Renderer:
    - Run ```npm uninstall roavatar-renderer```
    - Run ```npm link roavatar-renderer```
- Replace ```input: resolve(__dirname, 'index.html'),``` with ```input: resolve(__dirname, 'asset-download.html'),```
- Check out ```src/main-test.tsx``` and follow instructions there
- Run ```npm run build```
## 2. Load extension into chrome
- Instructions on how to are on https://github.com/steinann/RoAvatar
## 3. Actually download the assets
- Visit extension://EXTENSION_ID_CHROME_SHOWS_HERE/asset-download.html
- After avatar has loaded open the console and write ```downloadAll()```
## 4. In your website add the code example that was in main-test.tsx