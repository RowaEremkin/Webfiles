// WebSocket для обновления структуры в реальном времени
const socket = new WebSocket('ws://' + window.location.hostname + ':8000/ws/file_manager/');

let current_folder_id
let folder_access = false
let folderPath = ""
socket.onmessage = function(event) {
    const response = JSON.parse(event.data);
    console.log("OnMessage response: ", response)
    console.log("parentFolderId: ", response.parentFolderId)
    console.log("folderAccess: ", response.folderAccess)
    console.log("tree_path: ", response.treePath)
    folderPath = transformPath(response.treePath)
    if (response.action === "update") {
        current_folder_id = response.parentFolderId
        if (response.folderAccess == null){
            folder_access = false
        }
        else{
            folder_access = response.folderAccess
        }
        updateFolderTree(response.tree, response.parentFolderId);

        // Скрываем элементы, если доступ к папке запрещен
        document.getElementById('controls').style.display = folder_access==false?'none':"flex";
    }
    else if (response.action === "upload_success") {
        console.log("Upload successful:", response.data, " parentFolderId: ", response.parentFolderId);
        // Обновляем дерево файлов после успешной загрузки
        socket.send(JSON.stringify({ action: "reload", folder_id: response.parentFolderId }));
    }
    else if (response.action === "upload_error") {
        console.error("Upload failed:", response.error);
    }
    else if (response.action === "question_path"){
        let tree_path = window.location.pathname
        console.log("Send answer_path: ", tree_path)
        goToPath(tree_path);
    }
    history.pushState(null, '', folderPath);
};
function updateFolderTree(treeData, parentFolderId = null) {
    console.log("UpdateFolderTree: ", parentFolderId)
    function createPathLink(path, text){
        const link = document.createElement('a');
        link.textContent = text;
        link.classList.add("path")
        if(path != null){
            link.classList.add("path-click")
            link.onclick = (event) => {
                event.preventDefault();
                console.log(`Navigating to: ${path}`);
                goToPath(path);
            };
        }
        return link
    }
    function createPathDivide(){
        const divide = document.createElement('path_divide');
        divide.textContent = "/";
        return divide
    }
    const current_path = document.getElementById("current-path")
    current_path.innerHTML = ''
    let currentPath = '';
    const paths = folderPath.split('/');
    current_path.appendChild(createPathDivide())
    current_path.appendChild(createPathLink("/","Users"))
    current_path.appendChild(createPathDivide())
    paths.forEach((folder, index) => {
        if(folder !== ''){
            if(index!==1){
                current_path.appendChild(createPathDivide())
            }
            currentPath += (currentPath ? '/' : '') + folder;
            let path = '/' +currentPath;
            let link = null;
            if(index !== paths.length - 1){
                link = createPathLink(path, folder)
            }
            else{
                link = createPathLink(null, folder)
            }
            current_path.appendChild(link)
        }
    })
    const folderTree = document.getElementById("folder-tree");
    folderTree.innerHTML = "";
    // Создание кнопки "Назад"
    if (parentFolderId !== null) {
        const backButton = document.createElement("button");
        backButton.insertAdjacentHTML('afterbegin', Svg.backFolder);
        backButton.insertAdjacentText('beforeend', "...");
        backButton.classList.add("item");
        backButton.classList.add("back-button");
        backButton.onclick = () => backFolder(parentFolderId); // Функция для загрузки родительской папки
        folderTree.appendChild(backButton);
    }
    function createFolderList(items, parentElement) {
        console.log("CreateFolderList");
        items.forEach(item => {
            const li = document.createElement("button");
            li.classList.add("item");
            li.style.display = "flex"; // Используем flexbox для размещения элементов
            li.style.justifyContent = "space-between"; // Размещаем элементы по краям

            const icon = document.createElement("div");
            icon.id = "icon-" + item.id;
            li.appendChild(icon)

            const nameLabel = document.createElement("nameLabel");
            nameLabel.textContent = item.name;
            li.appendChild(nameLabel);

            const spacer = document.createElement("div");
            spacer.style.flexGrow = "1";
            li.appendChild(spacer);

            const controlPanel = document.createElement("controlPanel")
            controlPanel.classList.add("control-panel");
            li.appendChild(controlPanel);

            li.addEventListener('contextmenu', (e)=>toggleContextMenu(e, li))

            if (item.type === "folder") {
                icon.innerHTML = ('afterbegin', item.is_public?Svg.folder:Svg.privateFolder);
                li.id = "folder-" + item.id;
                li.classList.add("folder-item");
                li.onclick = (event) => {
                    event.stopPropagation();
                    event.stopImmediatePropagation()
                    openFolder(item.id);
                };

                if(item.edit_access == true){
                    const renameButton = document.createElement("button");
                    renameButton.classList.add("control-button");
                    renameButton.insertAdjacentHTML('afterbegin', Svg.rename);
                    renameButton.onclick = (event) => {
                        event.stopPropagation();
                        renameFolder(item.id);
                    };

                    const accessToggle = document.createElement("button");
                    accessToggle.classList.add("control-button");
                    accessToggle.id = "access-folder-toggle-" + item.id;
                    accessToggle.insertAdjacentHTML('afterbegin', item.is_public?Svg.publicAccess:Svg.privateAccess)
                    accessToggle.onclick = (event) => {
                        event.stopPropagation();
                        toggleFolderAccess(item.id);
                    };

                    const deleteButton = document.createElement("button");
                    deleteButton.classList.add("control-button");
                    deleteButton.insertAdjacentHTML('afterbegin', Svg.folderDelete);
                    deleteButton.onclick = (event) => {
                        event.stopPropagation();
                        deleteFolder(item.id); // Загружаем папку по клику
                    };

                    controlPanel.appendChild(deleteButton);
                    controlPanel.appendChild(accessToggle);
                    controlPanel.appendChild(renameButton);
                }
            }
            else {
                icon.innerHTML = ('afterbegin', item.is_public?Svg.file:Svg.privateFile);
                li.id = "file-" + item.id;
                li.onclick = (event) => {
                    event.stopPropagation();
                    event.stopImmediatePropagation()
                    openFile(item.id);
                };

                const downloadButton = document.createElement("button");
                downloadButton.classList.add("control-button");
                downloadButton.insertAdjacentHTML('afterbegin', Svg.download);
                downloadButton.onclick = (event) => {
                    event.stopPropagation();
                    downloadFile(item.id);
                };
                if(item.edit_access == true){
                    const renameButton = document.createElement("button");
                    renameButton.classList.add("control-button");
                    renameButton.insertAdjacentHTML('afterbegin', Svg.rename);
                    renameButton.onclick = (event) => {
                        event.stopPropagation();
                        renameFile(item.id);
                    };
                    const accessToggle = document.createElement("button");
                    accessToggle.classList.add("control-button");
                    accessToggle.id = "access-file-toggle-" + item.id;
                    accessToggle.insertAdjacentHTML('afterbegin', item.is_public?Svg.publicAccess:Svg.privateAccess)
                    accessToggle.onclick = (event) => {
                        event.stopPropagation();
                        toggleFileAccess(item.id);
                    };
                    const deleteButton = document.createElement("button");
                    deleteButton.classList.add("control-button");
                    deleteButton.insertAdjacentHTML('afterbegin', Svg.fileDelete);
                    deleteButton.onclick = (event) => {
                        event.stopPropagation();
                        deleteFile(item.id);
                    };

                    controlPanel.appendChild(deleteButton);
                    controlPanel.appendChild(accessToggle);
                    controlPanel.appendChild(renameButton);
                }
                controlPanel.appendChild(downloadButton);
            }

            const creationDateLabel = document.createElement("date-label");
        creationDateLabel.textContent = `${new Date(item.creation_date).toLocaleString()}`; // Форматируем дату
            li.appendChild(creationDateLabel);

            parentElement.appendChild(li);
        });
    }

    createFolderList(treeData, folderTree); // Генерация дерева
}

function getCsrfToken(){
    return getFromDocument("csrfmiddlewaretoken")
}
function getFromDocument(path) {
    const csrfToken = document.querySelector(`input[name=${path}]`)?.value; // Если токен есть на странице
    if (csrfToken) {
        return csrfToken;
    }

    // Если токен в cookie
    const name = "csrftoken";
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i].trim();
        if (cookie.startsWith(name + '=')) {
            return cookie.substring(name.length + 1);
        }
    }
    console.error("CSRF token not found");
    return null;
}
function decodeMimeString(mimeString) {
    try{
        // Удаляем префиксы и суффиксы
        const base64String = mimeString.replace(/^=\?utf-8\?b\?/, '').replace(/\?=$/, '');
        // Декодируем из Base64
        const decodedBytes = atob(base64String);
        // Преобразуем байты в строку UTF-8
        const decodedString = decodeURIComponent(escape(decodedBytes));
        return decodedString;
    }
    catch{
        return mimeString
    }
}
function transformPath(inputPath) {
    if(inputPath == null) return "/";
    if (inputPath.startsWith('\\')) {
        inputPath = inputPath.slice(1);
    }
    if(inputPath.length === 0) return "/"
    return inputPath.replace(/\\/g, '/');
}
let current_context_menu_element = null
function toggleContextMenu(e, element){
    e.preventDefault()
    const cm = element.querySelector('.control-panel')
    if(current_context_menu_element !== null){
        current_context_menu_element.classList.remove("control-panel-active")
    }
    if(cm.classList.contains("control-panel-active")){
        cm.classList.remove("control-panel-active")
    }
    else{
        cm.classList.add("control-panel-active")
        current_context_menu_element = cm;
    }
    document.addEventListener('click', function handleClickOutside(event) {
        if (!element.contains(event.target)) {
            cm.classList.remove("control-panel-active"); // Убираем класс
            current_context_menu_element = null
            document.removeEventListener('click', handleClickOutside); // Убираем обработчик после закрытия
        }
    });
}
// Функции файловой системы
async function handleFileInputChange(){
    const uploadButton = document.getElementById("upload-button");
    const fileInput = document.getElementById("file-input");
    if(fileInput.value === ''){
        uploadButton.style.display = "none";
    }
    else{
        uploadButton.style.display = "flex";
    }
}
async function uploadFiles() {
    const uploadButton = document.getElementById("upload-button");
    const fileInput = document.getElementById("file-input");
    function updateProgressBar(uploaded, total) {
        const percentage = (uploaded / total) * 100;
        progressBar.value = percentage; // Update the progress bar value

        if (uploaded === total) {
            console.log("All files uploaded");
            progressBar.style.display = "none";
            fileInput.value = '';
            fileInput.style.display = 'flex';
            uploadButton.style.display = "none";
        }
    }
    const files = fileInput.files;
    const folderId = current_folder_id;

    const progressBar = document.getElementById("upload-progress-bar");
    progressBar.value = 0;

    if (files.length === 0) {
        console.error("No files to upload");
        return;
    }

    const totalFiles = files.length;
    let uploadedFiles = 0;

    for (let i = 0; i < files.length; i++) {
        progressBar.style.display = "flex";
        fileInput.style.display = 'none';
        uploadButton.style.display = 'none';
        const file = files[i];
        const csrfToken = getCsrfToken();

        const formData = new FormData();
        formData.append('folder_id', folderId);
        formData.append('file_name', file.name);
        formData.append('file_blob', file);
        const creationDate = new Date(file.lastModified).toISOString();
        formData.append('creation_date', creationDate);

        try {
            const response = await fetch('/upload/', {
                method: 'POST',
                headers: {
                    'X-CSRFToken': csrfToken
                },
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Upload failed: ${response.statusText}`);
            }

            const result = await response.json();
            console.log(result.message);
            updateFolder()

        } catch (error) {
            console.error("Error uploading file:", error);
        }

        uploadedFiles++;
        updateProgressBar(uploadedFiles, totalFiles);
    }
}
function downloadFile(fileId) {
    fetch(`/download/${fileId}/`, {
        method: 'GET',
        credentials: 'include'
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = 'downloaded_file';
        console.log("contentDisposition: ", contentDisposition)
        filename = decodeMimeString(contentDisposition)
        if (filename && filename.includes('attachment')) {
            const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
            const matches = filenameRegex.exec(filename);

            if (matches != null && matches[1]) {
                filename = matches[1].replace(/['"]/g, '');
            }
        }
        console.log("filename: ", filename)

        return response.blob().then(blob => ({ blob, filename })); // Возвращаем Blob и имя файла
    })
    .then(({ blob, filename }) => {
        const url = window.URL.createObjectURL(blob); // Создаем URL для Blob
        const a = document.createElement('a'); // Создаем элемент <a>
        a.style.display = 'none';
        a.href = url;
        a.download = filename; // Используем имя файла из заголовка
        document.body.appendChild(a);
        a.click(); // Имитируем клик для скачивания
        window.URL.revokeObjectURL(url); // Освобождаем память
    })
    .catch(error => console.error('Error downloading file:', error));
}
function openFile(fileId) {
    fetch(`/open/${fileId}/`, {
        method: 'GET',
        credentials: 'include'
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = 'downloaded_file';

        if (contentDisposition && contentDisposition.includes('attachment')) {
            const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
            const matches = filenameRegex.exec(contentDisposition);

            if (matches != null && matches[1]) {
                filename = matches[1].replace(/['"]/g, '');
            }
        }

        return response.blob().then(blob => ({ blob, filename }));
    })
    .then(({ blob, filename }) => {
        const url = window.URL.createObjectURL(blob);
        document.getElementById('modalFileContent').innerHTML = `<iframe class="file-frame" src="${url}" ></iframe>`;
        document.getElementById('modalFile').style.display = 'block';

        // Обработка кнопки загрузки
        document.getElementById('modalDownloadButton').onclick = function() {
            downloadFile(fileId)
        };
        function closeModal(event) {
            const modal = document.getElementById('fileModal');
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        };
        window.onclick = closeModal;
        document.addEventListener('click', function handleClickOutside(event) {
            const modal = document.getElementById('modalContent');
            if (event.target === modal) {
                closeModal(event)
                document.removeEventListener('click', handleClickOutside);
            }
        });

        window.URL.revokeObjectURL(url);
    })
    .catch(error => console.error('Error opening file:', error));
}

function renameFile(fileId) {
    const csrfToken = getCsrfToken();
    const fileElement = document.getElementById(`file-${fileId}`);
    let nameLabel = null
    if (fileElement) {
        nameLabel = fileElement.querySelector('nameLabel');
    }
    const newName = prompt("Enter new file name:", nameLabel?.textContent);

    if (newName) {
        fetch(`/rename_file/${fileId}/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-CSRFToken': csrfToken // Получите CSRF-токен из cookie
            },
            body: new URLSearchParams({
                'new_name': newName
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log(`File rename to: ${data.new_name}`);
                if (nameLabel) {
                    nameLabel.textContent = newName;
                }
            } else {
                console.error('Error on file rename');
            }
        })
        .catch(error => console.error('Error:', error));
    }
}
function toggleFileAccess(fileId) {
    const csrfToken = getCsrfToken();
    let elementId = 'access-file-toggle-'+fileId;
    console.log("elementId: ", fileId)
    let accessToggle = document.getElementById(elementId)
    let iconId = 'icon-'+fileId;
    let icon = document.getElementById(iconId)
    fetch(`/toggle_file_access/${fileId}/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken // Получите CSRF-токен из cookie
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log(`File access changed: ${data.is_public ? 'public' : 'private'}`);
            if(accessToggle !== null){
                accessToggle.innerHTML = ('afterbegin', data.is_public?Svg.publicAccess:Svg.privateAccess)
            }
            if(icon !== null){
                icon.innerHTML = ('afterbegin', data.is_public?Svg.file:Svg.privateFile);
            }
        } else {
            console.error('Error on change file access');
        }
    })
    .catch(error => console.error('Error:', error));
}
function deleteFile(fileId) {
    const csrfToken = getCsrfToken(); // Получите CSRF-токен из cookie

    if (confirm("Вы уверены, что хотите удалить этот файл?")) {
        fetch(`/delete_file/${fileId}/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-CSRFToken': csrfToken
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log(`Файл с ID ${fileId} успешно удален.`);
                const fileElement = document.getElementById(`file-${fileId}`);
                if (fileElement) {
                    fileElement.remove();
                }
            } else {
                console.error('Ошибка при удалении файла');
            }
        })
        .catch(error => console.error('Ошибка:', error));
    }
}
function renameFolder(folderId){
    const csrfToken = getCsrfToken();

    const folderElement = document.getElementById(`folder-${folderId}`);
    let nameLabel = null
    if (folderElement) {
        nameLabel = folderElement.querySelector('nameLabel');
    }
    const newName = prompt("Enter new folder name:", nameLabel.textContent);

    if (newName) {
        fetch(`/rename_folder/${folderId}/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-CSRFToken': csrfToken
            },
            body: new URLSearchParams({
                'new_name': newName
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log(`Folder rename to: ${data.new_name}`);
                if (nameLabel) {
                    nameLabel.textContent = newName;
                }
            } else {
                console.error('Error on rename folder');
            }
        })
        .catch(error => console.error('Error:', error));
    }
}
function toggleFolderAccess(folderId) {
    const csrfToken = getCsrfToken();
    let elementId = 'access-folder-toggle-'+folderId;
    console.log("elementId: ", elementId)
    let accessToggle = document.getElementById(elementId)
    let iconId = 'icon-'+folderId;
    let icon = document.getElementById(iconId)
    fetch(`/toggle_folder_access/${folderId}/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken // Получите CSRF-токен из cookie
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log(`Folder ${folderId} access changed: ${data.is_public ? 'Public' : 'Private'}`);
            if(accessToggle !== null){
                accessToggle.innerHTML = ('afterbegin', data.is_public?Svg.publicAccess:Svg.privateAccess)
            }
            if(icon !== null){
                icon.innerHTML = ('afterbegin', data.is_public?Svg.folder:Svg.privateFolder);
            }
        } else {
            console.error('Error on change folder access');
        }
    })
    .catch(error => console.error('Error on change folder access with id ${folderId}:', error));
}
function deleteFolder(folderId) {
    const csrfToken = getCsrfToken(); // Получите CSRF-токен из cookie

    if (confirm("Вы уверены, что хотите удалить эту папку и все ее содержимое?")) {
        fetch(`/delete_folder/${folderId}/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-CSRFToken': csrfToken
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log(`Папка с ID ${folderId} успешно удалена.`);
                const folderElement = document.getElementById(`folder-${folderId}`);
                if (folderElement) {
                    folderElement.remove();
                }
            } else {
                console.error('Ошибка при удалении папки');
            }
        })
        .catch(error => console.error('Ошибка:', error));
    }
}
function createFolder() {
    console.log("CreateFolder")
    const folderName = prompt("Enter folder name:");
    if (!folderName) {
        alert("Folder name can not be empty.");
        return;
    }

    const parentId = current_folder_id; // Получаем текущий родительский ID

    const csrfToken = getCsrfToken(); // Получаем CSRF-токен

    fetch(`/create_folder/?parent_id=${parentId}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "X-CSRFToken": csrfToken,
        },
        body: new URLSearchParams({ name: folderName }), // Передаём имя папки
    })
        .then(response => {
            if (!response.ok) {
                throw new Error("Failed to create folder");
            }
            return response.json();
        })
        .then(data => {
            if (data.error) {
                alert(`Error: ${data.error}`);
            } else {
                console.log('Folder with name ${folderName} created');
                updateFolder()
            }
        })
        .catch(error => {
            console.error("Error:", error);
        });
}
function createFile() {
    console.log("CreateFile")
    const fileName = prompt("Введите название файла:");
    const fileContent = prompt("Введите содержимое файла:");

    if (!fileName) {
        alert("Название файла не может быть пустым.");
        return;
    }

    const folderId = current_folder_id; // Текущая папка

    const csrfToken = getCsrfToken();

    fetch(`/create_file/`, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "X-CSRFToken": csrfToken,
        },
        body: new URLSearchParams({ folder_id: folderId, name: fileName, content: fileContent }),
    })
        .then(response => {
            if (!response.ok) {
                throw new Error("Failed to create file");
            }
            return response.json();
        })
        .then(data => {
            if (data.error) {
                alert(`Ошибка: ${data.error}`);
            } else {
                alert("Файл успешно создан.");
                updateFolder()
            }
        })
        .catch(error => {
            console.error("Error:", error);
        });
}
function backFolder(folderId) {
    console.log("Back Folder: ", folderId)
    const messageObject = { action: "back", folder_id: folderId };
    socket.send(JSON.stringify(messageObject));
}
function openFolder(folderId) {
    console.log("Open Folder: ", folderId)
    const messageObject = { action: "reload", folder_id: folderId };
    socket.send(JSON.stringify(messageObject));
}
function updateFolder() {
    openFolder(current_folder_id)
}
function goToPath(folder_path){
    socket.send(JSON.stringify({ action: "answer_path", tree_path: folder_path }));
}
function closeModalFile(){
    document.getElementById('modalFile').style.display = 'none';
}
document.addEventListener("DOMContentLoaded", function() {
    const createFolderButton = document.createElement("button");
    createFolderButton.classList.add('control-button')
    createFolderButton.textContent = ("Create folder");
    createFolderButton.insertAdjacentHTML('afterbegin', Svg.createFolder);
    createFolderButton.onclick = createFolder;

    const createFileButton = document.createElement("button");
    createFileButton.classList.add('control-button')
    createFileButton.textContent = ("Create file");
    createFileButton.insertAdjacentHTML('afterbegin', Svg.createFile);
    createFileButton.onclick = createFile;

    const controls = document.getElementById("controls");
    controls.appendChild(createFolderButton);
    controls.appendChild(createFileButton);

    const fileInput = document.createElement('input');
    fileInput.className = 'control-button';
    fileInput.type = 'file';
    fileInput.id = 'file-input';
    fileInput.multiple = true; // Позволяет выбирать несколько файлов
    fileInput.onchange = handleFileInputChange; // Устанавливаем обработчик события

    controls.appendChild(fileInput)

    // Добавляем CSRF токен (если используется Django)
    const csrfToken = document.createElement('input');
    csrfToken.type = 'hidden';
    csrfToken.name = 'csrfmiddlewaretoken';
    csrfToken.value = '{{ csrf_token }}'; // Замените на актуальный токен при

    controls.appendChild(csrfToken)


    const progressBar = document.createElement('progress');
    progressBar.id = 'upload-progress-bar';
    progressBar.value = 0; // Начальное значение прогресса
    progressBar.max = 100; // Максимальное значение прогресса
    progressBar.style.display = 'none'; // Изначально скрываем прогресс-бар

    controls.appendChild(progressBar)

    const uploadButton = document.createElement('button');
    uploadButton.className = 'control-button';
    uploadButton.id = 'upload-button';
    uploadButton.onclick = uploadFiles; // Устанавливаем обработчик события
    uploadButton.style.display = 'none'; // Изначально скрываем кнопку
    uploadButton.textContent = 'Upload'; // Текст кнопки
    uploadButton.insertAdjacentHTML('afterbegin', Svg.upload);

    controls.appendChild(uploadButton)
});
const siteName = document.getElementById('site-name');
siteName.insertAdjacentHTML('afterbegin', Svg.folderRoot);