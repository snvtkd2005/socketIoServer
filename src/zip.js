
const formidable = require('formidable');
const fs = require('fs');
const archiver = require('archiver');
const fspromises = require('fs').promises;
const path = require('path');

/** 复制文件测试
 
function testCopyFile(){
    fs.cp("./metaworld.txt","./copy/metawod.txt",(err)=>{
        if(err){
            console.error(err);
        }
    }); 
} 
testCopyFile();
 
 */

// 复制scene文件夹
// 从scene.txt提取场景内模型
// 复制场景内模型
// 打包 

const UPLOAD_DIR = './uploads/';
const UPLOAD_DIR_AUDIO = './uploadsAudio/';
const UPLOAD_DIR_GROUP = './uploadsGroup/';
const UPLOAD_DIR_SCENE = './uploadsScene/';
const UPLOAD_DIR_HDR = './uploadsHDR/';
const UPLOAD_DIR_UVANIM = './uploadsUVAnim/';
const UPLOAD_DIR_SKILL = './uploadsSkill/';
const UPLOAD_DIR_PLAYER = './uploadsPlayer/';

const LoadSceneByFolderBase = function (folderBase) {

    // 使用示例  
    const sourceDir = UPLOAD_DIR_SCENE + folderBase;
    const destDir = './zip/' + new Date().getTime();
    copyDir(sourceDir, destDir)
        .then(() => console.log('文件夹复制成功'))
        .catch(err => console.error('文件夹复制失败', err));

    fs.readFile(UPLOAD_DIR_SCENE + folderBase + "/setting.txt", 'utf8', (err, data) => {
        if (err) throw err;
        let setting = JSON.parse(data);
        //从数据中提取使用的音频、图片
        console.log(setting);

        // console.log(" scene.folderBase ",scene.folderBase);
    });
    fs.readFile(UPLOAD_DIR_SCENE + folderBase + "/scene.txt", 'utf8', (err, data) => {
        if (err) throw err;
        let modelList = JSON.parse(data);
        console.log(modelList);

        for (let i = 0; i < modelList.length; i++) {
            const element = modelList[i];
            if (element.modelType == "组合") {

            } else {
                //从数据中提取使用的音频、图片
                let modelSourceDir = UPLOAD_DIR + element.folderBase;
                let destmodelSourceDir = destDir + '/' + modelSourceDir.replace("./", "");
                copyDir(modelSourceDir, destmodelSourceDir)
                    .then(() => console.log('文件夹复制成功'))
                    .catch(err => console.error('文件夹复制失败', err));
            }
        }
        // console.log(folderData);

        // console.log(" scene.folderBase ",scene.folderBase);
    });
}
LoadSceneByFolderBase(1705644493237);
return;

async function copyDir(src, dest) {
    // 读取源目录内容  
    const entries = await fspromises.readdir(src, { withFileTypes: true });

    // 确保目标目录存在  
    await fspromises.mkdir(dest, { recursive: true });

    for (let entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            // 如果是目录，则递归复制  
            await copyDir(srcPath, destPath);
        } else {
            // 如果是文件，则复制文件  
            await fspromises.copyFile(srcPath, destPath);
        }
    }
}



// 创建一个输出流（写入文件）  
const output = fs.createWriteStream('./output.zip');
const archive = archiver('zip', {
    zlib: { level: 9 } // 设置压缩级别  
});

// 监听压缩进度（可选）  
archive.on('progress', function (progress) {
    console.log(Math.round((progress.percent * 100)) + '% completed');
});

// 管道化压缩数据到文件  
archive.pipe(output);

// 附加文件或目录到归档文件  
// 这里的'folderToCompress'是你想要压缩的文件夹的名称  
const folderPath = './copy2';

// 递归地将文件夹内容添加到归档中  
function archiveDirectory(sourceDir, baseDir, archive) {
    const files = [];
    // 读取文件夹中的所有文件和子文件夹  
    const entries = fs.readdirSync(sourceDir, { withFileTypes: true });

    for (let entry of entries) {
        const filePath = path.join(sourceDir, entry.name);
        const relativePath = path.relative(baseDir, filePath);

        if (entry.isDirectory()) {
            // 如果是目录，则递归添加  
            archiveDirectory(filePath, baseDir, archive);
        } else {
            // 如果是文件，则添加到归档中  
            files.push(relativePath);
        }
    }

    // 排序文件以确保目录结构正确（可选）  
    files.sort();

    // 将文件添加到归档中  
    files.forEach(function (file) {
        archive.append(fs.createReadStream(path.join(baseDir, file)), { name: file });
    });
}

// 开始压缩  
archiveDirectory(folderPath, folderPath, archive);

// 完成归档  
archive.finalize().then(() => {
    console.log('Archive created');
}).catch(err => {
    throw err;
});