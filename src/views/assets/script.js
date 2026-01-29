/******************************************************************************************
 * Group Search
 */

const groupInput = document.getElementById('group-input');
const groupOptions = document.getElementById('group-options');
const groupValue = document.getElementById('group-select-value');

let Groups = [];

async function UpdateGroups()
{
    const res = await fetch('/api/groups');
    
    if (res.status === 401 || !res.ok)
        return;

    const result = await res.json();

    if (!result.status || !result.groups)
        return;

    Groups = result.groups;
}

async function ShowGroups(filter)
{
    groupOptions.innerHTML = "";

    const allDiv = document.createElement('div');
    allDiv.className = 'dropdown-option';
    allDiv.textContent = 'All';

    allDiv.onclick = () => {
        groupInput.value = '';
        groupValue.value = '';
        groupOptions.style.display = 'none';
    };

    groupOptions.appendChild(allDiv);

    if (filter && filter == "")
        filter = null;

    Groups.forEach(group => {
        if (filter && !group.group_name.toLowerCase().includes(filter))
            return;

        const div = document.createElement('div');
        div.className = 'dropdown-option';
        div.textContent = group.group_name;

        div.onclick = () => {
            groupInput.value = div.textContent;
            groupValue.value = group.group_id;
            groupOptions.style.display = 'none';
        };

        groupOptions.appendChild(div);
    });
}

groupInput.addEventListener('focus', async() => {
    groupOptions.style.display = 'block';
    const query = groupInput.value.toLowerCase();
    await UpdateGroups()
    await ShowGroups(query);
});

groupInput.addEventListener('input', async () => {
    groupOptions.style.display = 'block';
    const query = groupInput.value.toLowerCase();
    await ShowGroups(query);
});

document.addEventListener('click', (e) => {
    if (!groupInput.contains(e.target) && !groupOptions.contains(e.target)) {
        groupOptions.style.display = 'none';
    }
});

/******************************************************************************************
 * User Search
 */

const userInput = document.getElementById('user-input');
const userOptions = document.getElementById('user-options');
const userValue = document.getElementById('user-select-value');

let Users = [];

async function UpdateUsers()
{
    let res;

    if (groupValue.value != "")
        res = await fetch(`/api/users/${groupValue.value}`);
    else
        res = await fetch('/api/users');
    
    if (res.status === 401 || !res.ok)
        return;

    const result = await res.json();

    if (!result.status || !result.users)
        return;

    Users = result.users;
}

async function ShowUsers(filter)
{
    userOptions.innerHTML = "";

    const allDiv = document.createElement('div');
    allDiv.className = 'dropdown-option';
    allDiv.textContent = 'All';

    allDiv.onclick = () => {
        userInput.value = '';
        userValue.value = '';
        userOptions.style.display = 'none';
    };

    userOptions.appendChild(allDiv);

    if (filter && filter == "")
        filter = null;

    Users.forEach(user => {
        if (filter && !user.user_name.toLowerCase().includes(filter))
            return;

        const div = document.createElement('div');
        div.className = 'dropdown-option';
        div.textContent = user.user_name;

        div.onclick = () => {
            userInput.value = div.textContent;
            userValue.value = user.user_id;
            userOptions.style.display = 'none';
        };

        userOptions.appendChild(div);
    });
}

userInput.addEventListener('focus', async() => {
    userOptions.style.display = 'block';
    const query = userInput.value.toLowerCase();
    await UpdateUsers()
    await ShowUsers(query);
});

userInput.addEventListener('input', async () => {
    userOptions.style.display = 'block';
    const query = userInput.value.toLowerCase();
    await ShowUsers(query);
});

document.addEventListener('click', (e) => {
    if (!userInput.contains(e.target) && !userOptions.contains(e.target)) {
        userOptions.style.display = 'none';
    }
});

/******************************************************************************************
 * Embed Sticker
 */

const EmbedSticker = function(path, size = 100)
{
    if (!path) return '';

    if (path.endsWith(".webp") || path.endsWith(".png") || path.endsWith(".jpg")) {
        return `<img src="${path}" width="${size}" style="aspect-ratio: 1/1; object-fit: contain;" alt="File">`;
    }

    // Videos (WebM, MP4)
    if (path.endsWith(".webm") || path.endsWith(".mp4")) {
        return `<video src="${path}" width="${size}" autoplay loop muted playsinline style="aspect-ratio: 1/1; object-fit: contain;"></video>`;
    }

    /*if (path.endsWith(".tgs")) {
        // TODO: This;
    }*/

    return `<a href=${path} style="font-size: 10px;">Unsupported Sticker</span>`;
}

/******************************************************************************************
 * Embed File
 */

const EmbedFile = function(file, size = 100)
{
    if (!file) return '';

    const url = file.thumb_url || file.file_url;

    if (url.endsWith(".webp") || url.endsWith(".png") || url.endsWith(".jpg"))
        return `<a href=${file.file_url}><img src="${url}" width="${size}" style="aspect-ratio: 1/1; object-fit: contain;" alt="File"></a>`;

    if (file.file_name)
        return `<a href=${file.file_url}>${file.file_name}</a>`;

    if (url.endsWith(".webm") || url.endsWith(".mp4")) 
        return `<a href=${file.file_url}>Video File</a>`;
    
    if (url.endsWith(".mp3") || url.endsWith(".ogg") || url.endsWith(".wav"))
        return `<a href=${file.file_url}>Audio File</a>`;

    /*if (path.endsWith(".tgs")) {
        // TODO: This;
    }*/

    return `<a href=${url} style="font-size: 10px;">Unsupported format</span>`;
}

const EmbedFiles = function(files, size = 100)
{
    return files.map(file => EmbedFile(file, size)).join(" ");
}

async function HideAttachments(button, element, attachments)
{
    button.onclick = () => ShowAttachments(button, element, attachments);
    button.innerText = "Hide Files";
    element.style.display = 'none';
}

async function ShowAttachments(button, element, attachments)
{
    button.onclick = () => HideAttachments(button, element, attachments);
    button.innerText = "Show Files";
    element.style.display = 'table-row';
    element.innerHTML = `<td colspan="6"> Attachments: ${EmbedFiles(attachments, 100)} </td>`;
}

/******************************************************************************************
 * Show History
 */

async function HideHistory(button, history, message)
{
    button.onclick = () => ShowHistory(button, history, message);
    button.innerText = "Expand";
    history.style.display = 'none';
}

async function ShowHistory(button, history, message)
{
    button.onclick = () => HideHistory(button, history, message);
    button.innerText = "Colapse";
    history.style.display = 'table-row';
    history.innerHTML = `<td colspan="6"> <div style="padding: 10px;">Loading history...</div> </td>`;

    const params = new URLSearchParams();
    params.append('group_id', message.group_id);
    params.append('message_id', message.message_id);
    params.append('include_stickers', showStickers.checked);
    params.append('include_attachments', showAttachments.checked);

    params.append('activity', "EDIT");

    const res = await fetch(`/api/messages?${params.toString()}`);

    if (res.status === 401 || !res.ok)
    {
        alert("Internal error.");
        return;
    }

    const result = await res.json();

    if (!result.status)
    {
        alert(result.error || "Uknown internal error.");
        return;
    }

    if (!result.messages)
    {
        Messages = [ ];
        alert("No results found.");
        return;
    }

    result.messages.sort((a, b) => a.version - b.version)

    let html = `
        <table class="history-table">
            <thead>
                <tr>
                    <th>Version</th>
                    <th>Date</th>
                    <th>Text</th>
                    <th>Activity</th>
                </tr>
            </thead>
            <tbody>
    `;

    result.messages.forEach(message => {
        let text = message.message_text.replaceAll("\n","<br>");

        if (message.sticker_path)
            text = `${EmbedSticker(message.sticker_path)}<br>`;

        html += `
            <tr>
                <td>${message.version}</td>
                <td>${new Date(message.timestamp).toLocaleString()}</td>
                <td>${text}</td>
                <td>${message.activity}</td>
            </tr>
        `;

        if (message.attachments)
            html += `
                <tr>
                    <td colspan="6"> Attachments: ${EmbedFiles(message.attachments, 100)} </td>
                </tr>
            `;
    });

    html += `</tbody></table>`;
    history.cells[0].innerHTML = html;
}

/******************************************************************************************
 * Message Search
 */

const searchBtn = document.getElementById('search-btn');
const startDate = document.getElementById('start-date');
const endDate = document.getElementById('end-date');

const messagesTableBody = document.querySelector('#messages-table tbody');
const contentDiv = document.getElementById('content');
const headerDiv = document.getElementById('header');

const showStickers = document.getElementById('show-stickers');
const showAttachments = document.getElementById('show-attachments');

const pageNumber = document.getElementById('page-number');
const pageLimit = document.getElementById('page-dropdown');

const previousPage = document.getElementById('previous-page');
const nextPage = document.getElementById('next-page');

const firstPage = document.getElementById('fist-page');
const lastPage = document.getElementById('last-page');

let Page = 0;
let Total = 0;
let Messages = [];

async function UpdateMessages(page = 0)
{
    if (page < 0)
        page = 0;

    const params = new URLSearchParams();

    if (groupValue.value != "")
        params.append('group_id', groupValue.value);

    if (userValue.value != "")
        params.append('user_id', userValue.value);

    if (startDate)
        params.append('from', startDate.value);

    if (endDate)
        params.append('to', endDate.value);

    params.append('activity', "POST");
    params.append('include_stickers', showStickers.checked);
    params.append('include_attachments', showAttachments.checked);

    params.append('page', page);
    params.append('limit', pageLimit.value);

    const res = await fetch(`/api/messages?${params.toString()}`);

    if (res.status === 401 || !res.ok)
    {
        alert("Internal error.");
        return;
    }

    const result = await res.json();

    if (!result.status)
    {
        alert(result.error || "Uknown internal error.");
        return;
    }

    if (!result.messages)
    {
        Messages = [ ];
        alert("No results found.");
        return;
    }

    Messages = result.messages;
    Total = result.total;
    Page = page;
}

async function ShowMessages()
{
    messagesTableBody.innerHTML = '';

    Messages.forEach(message => {
        const row = document.createElement('tr');

        let text = message.message_text.replaceAll("\n","<br>");

        if (message.sticker_path)
            text = `${EmbedSticker(message.sticker_path)}<br>`;

        row.innerHTML = `
            <td>${new Date(message.timestamp).toLocaleString()}</td>
            <td>${message.group_name || msg.group_id}</td>
            <td>${message.poster_name}</td>
            <td>${text}</td>
            <td>${message.edit_count || 0}</td>
            <td>${message.file_count || 0}</td>
        `;

        const controls = document.createElement('td');
        row.appendChild(controls);

        const attachments = document.createElement('tr');
        attachments.className = 'history-row';

        if (message.attachments) {
            console.log(message.attachments)
            const button = document.createElement('button');
            button.className = "expand-btn";
            button.innerText = "Show Files";
            button.expanded = false;

            button.onclick = () => ShowAttachments(button, attachments, message.attachments);

            controls.appendChild(button)
        }

        const history = document.createElement('tr');
        history.className = 'history-row';
        
        if (message.edit_count > 0) {
            const button = document.createElement('button');
            button.className = "expand-btn";
            button.innerText = "Expand";
            button.expanded = false;

            button.onclick = () => ShowHistory(button, history, message);

            controls.appendChild(button)
        }
        
        messagesTableBody.appendChild(row);
        //messagesTableBody.appendChild(reply);
        messagesTableBody.appendChild(attachments);
        messagesTableBody.appendChild(history);
    });

    const pages = Math.ceil(Total / pageLimit.value) + 1;

    pageNumber.innerHTML = `Page ${Page + 1} / ${pages}`;// | Results ${(Page) * pageLimit.value} / ${Total}`;
    
    previousPage.style.display = (Page > 0) ? "block" : "none";
    nextPage.style.display = (Page < pages - 1) ? "block" : "none";

    firstPage.style.display = (Page > 0) ? "block" : "none";
    lastPage.style.display = (Page < pages) ? "block" : "none";
}

searchBtn.addEventListener('click', async () => {
    await UpdateMessages();
    await ShowMessages();
});

previousPage.onclick = async () => {
    await UpdateMessages(Page - 1);
    await ShowMessages();
}

nextPage.onclick = async () => {
    await UpdateMessages(Page + 1);
    await ShowMessages();
}

firstPage.onclick = async () => {
    await UpdateMessages(0);
    await ShowMessages();
}

lastPage.onclick = async () => {
    await UpdateMessages(Math.ceil(Total / pageLimit.value));
    await ShowMessages();
}