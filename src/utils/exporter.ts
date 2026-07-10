import { Note, Folder, AppSettings } from '../types';

/**
 * Bundles the user's current Notes database into a single, fully functioning
 * standalone HTML file ("Note Android.html") featuring identical iOS-inspired styling,
 * list widgets, media renderings, search, and language preferences.
 */
export function generateStandaloneHtml(notes: Note[], folders: Folder[], settings: AppSettings): string {
  const serializedNotes = JSON.stringify(notes);
  const serializedFolders = JSON.stringify(folders);
  const serializedSettings = JSON.stringify(settings);

  return `<!DOCTYPE html>
<html lang="${settings.language}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Note Android - Standalone App</title>
    <!-- Include Tailwind CSS CSS-only stylesheet -->
    <script src="https://cdn.tailwindcss.com"></script>
    <!-- Google Fonts for handwriting and monospace matching settings -->
    <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&family=JetBrains+Mono:wght@400;700&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        body {
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            background-color: #0c0c0e;
            color: #f4f4f5;
        }
        .font-serif { font-family: 'Playfair Display', Georgia, serif; }
        .font-monospace { font-family: 'JetBrains Mono', monospace; }
        .font-handwritten { font-family: 'Caveat', cursive; }
        
        /* Custom iOS style scrollbar */
        ::-webkit-scrollbar {
            width: 6px;
            height: 6px;
        }
        ::-webkit-scrollbar-track {
            background: transparent;
        }
        ::-webkit-scrollbar-thumb {
            background: #3a3a3c;
            border-radius: 10px;
        }
        .ios-shadow {
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
        }
    </style>
    <script>
        // Inline configuration
        tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {
                    colors: {
                        iosYellow: '${settings.primaryColor || '#E5A93C'}',
                        iosDarkBg: '#1c1c1e',
                        iosLightBg: '#f2f2f7',
                        iosCardDark: '#2c2c2e',
                    }
                }
            }
        }
    </script>
</head>
<body class="bg-zinc-950 text-zinc-100 min-h-screen">

    <div class="max-w-md mx-auto bg-zinc-900 border-x border-zinc-800 min-h-screen flex flex-col relative ios-shadow">
        
        <!-- Header / Navigation Bar -->
        <header class="sticky top-0 bg-zinc-900/90 backdrop-blur-md border-b border-zinc-800 p-4 z-40 flex items-center justify-between">
            <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <h1 class="text-lg font-bold tracking-tight text-zinc-100 flex items-center gap-1.5">
                    Note Android <span class="bg-zinc-800 text-[10px] uppercase font-mono px-1.5 py-0.5 rounded text-zinc-400">Offline</span>
                </h1>
            </div>
            
            <button id="help-btn" class="text-zinc-400 hover:text-zinc-200 text-xs bg-zinc-800 px-2 py-1 rounded">
                Info
            </button>
        </header>

        <!-- Main Wrapper -->
        <main class="flex-grow p-4 flex flex-col gap-4">
            
            <!-- Quick summary stats -->
            <div class="grid grid-cols-2 gap-3">
                <div class="bg-zinc-800/50 p-3 rounded-xl border border-zinc-800">
                    <span class="text-xs text-zinc-400 block" id="lbl-total-folders">Folders</span>
                    <strong class="text-xl text-yellow-500" id="stat-folders">0</strong>
                </div>
                <div class="bg-zinc-800/50 p-3 rounded-xl border border-zinc-800">
                    <span class="text-xs text-zinc-400 block" id="lbl-total-notes">Notes</span>
                    <strong class="text-xl text-yellow-500" id="stat-notes">0</strong>
                </div>
            </div>

            <!-- Search bar -->
            <div class="relative">
                <input 
                    id="search-input" 
                    type="text" 
                    placeholder="Cerca nota o contenuto..." 
                    class="w-full bg-zinc-800 border border-zinc-700/60 rounded-xl py-2 px-3 pl-9 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                />
                <span class="absolute left-3 top-2.5 text-zinc-500">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                </span>
            </div>

            <!-- Standalone Views Switcher -->
            <div class="flex gap-1.5 bg-zinc-800/60 p-1 rounded-xl">
                <button id="view-tabs-all" class="flex-1 text-center text-xs py-1.5 rounded-lg font-medium bg-yellow-500 text-zinc-950 transition-colors">
                    Tutte le note
                </button>
                <button id="view-tabs-folders" class="flex-1 text-center text-xs py-1.5 rounded-lg font-medium text-zinc-400 hover:text-zinc-200 transition-colors">
                    Cartelle
                </button>
            </div>

            <!-- Dynamic List Content container -->
            <div id="list-container" class="space-y-2.5 flex-grow">
                <!-- Javascript will inject list cards here -->
            </div>
        </main>

        <!-- Dynamic Modal for Note Preview / Read Only Mode -->
        <div id="note-modal" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center hidden">
            <div id="modal-container" class="bg-zinc-900 border-t border-zinc-800 w-full max-w-md rounded-t-3xl p-5 space-y-4 max-h-[85vh] overflow-y-auto transform translate-y-full transition-transform duration-300">
                
                <div class="flex justify-between items-center">
                    <span class="text-xs font-mono text-zinc-500" id="preview-note-date">May 30, 2026</span>
                    <button id="close-modal-btn" class="p-1 px-3 bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-sm rounded-full">
                        Chiudi
                    </button>
                </div>

                <div class="border-b border-zinc-800/80 pb-3">
                    <h2 id="preview-note-title" class="text-2xl font-bold text-zinc-100">Note Title</h2>
                    <span id="preview-note-folder" class="text-xs bg-yellow-500/10 text-yellow-500 px-2.5 py-0.5 rounded-full font-medium inline-block mt-1.5">Folder Name</span>
                </div>

                <!-- Rich Rendered Note Content -->
                <div id="preview-note-body" class="text-zinc-300 space-y-3 leading-relaxed text-sm overflow-x-auto min-h-[150px]">
                    <!-- Inline colored text and tags -->
                </div>

                <!-- Attachments Display -->
                <div id="preview-attachments-section" class="pt-4 border-t border-zinc-800/80 hidden">
                    <h4 class="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Allegati</h4>
                    <div id="preview-attachments-grid" class="grid grid-cols-1 gap-3">
                        <!-- Attachment slots dynamic injection -->
                    </div>
                </div>

                <!-- Action Toolbar for note in modal -->
                <div class="pt-4 border-t border-zinc-800 flex gap-2">
                    <button id="btn-export-txt" class="flex-1 py-2 text-xs bg-zinc-800 text-zinc-200 rounded-lg hover:bg-zinc-750 font-medium">
                        Export TXT
                    </button>
                    <button id="btn-copy-clipboard" class="flex-1 py-2 text-xs bg-zinc-800 text-zinc-200 rounded-lg hover:bg-zinc-750 font-medium">
                        Copia Contenuto
                    </button>
                </div>
            </div>
        </div>

        <footer class="p-4 bg-zinc-900 border-t border-zinc-800/60 text-center text-[11px] text-zinc-500">
            Note Android offline. Modifiche non permesse in questo export statico.
        </footer>
    </div>

    <!-- Data payloads -->
    <script id="notes-payload" type="application/json">${serializedNotes}</script>
    <script id="folders-payload" type="application/json">${serializedFolders}</script>
    <script id="settings-payload" type="application/json">${serializedSettings}</script>

    <!-- App Logic Injection -->
    <script>
        const notes = JSON.parse(document.getElementById('notes-payload').textContent || '[]');
        const folders = JSON.parse(document.getElementById('folders-payload').textContent || '[]');
        const settings = JSON.parse(document.getElementById('settings-payload').textContent || '{}');

        let currentActiveView = 'all'; // 'all' or 'folders'
        let currentSelectedFolderId = null; 
        let searchKeyword = '';

        // DOM elements
        const listContainer = document.getElementById('list-container');
        const viewAllBtn = document.getElementById('view-tabs-all');
        const viewFoldersBtn = document.getElementById('view-tabs-folders');
        const searchInput = document.getElementById('search-input');
        
        const noteModal = document.getElementById('note-modal');
        const modalContainer = document.getElementById('modal-container');
        const closeModalBtn = document.getElementById('close-modal-btn');
        
        const previewTitle = document.getElementById('preview-note-title');
        const previewDate = document.getElementById('preview-note-date');
        const previewFolder = document.getElementById('preview-note-folder');
        const previewBody = document.getElementById('preview-note-body');
        const previewAttachmentsSection = document.getElementById('preview-attachments-section');
        const previewAttachmentsGrid = document.getElementById('preview-attachments-grid');
        
        const btnExportTxt = document.getElementById('btn-export-txt');
        const btnCopyClipboard = document.getElementById('btn-copy-clipboard');

        let selectedPreviewNote = null;

        // Init page labels & counters
        const langIsIt = (settings.language === 'it');
        document.getElementById('lbl-total-folders').innerText = langIsIt ? 'Cartelle' : 'Folders';
        document.getElementById('lbl-total-notes').innerText = langIsIt ? 'Note' : 'Notes';
        document.getElementById('stat-folders').innerText = folders.length;
        document.getElementById('stat-notes').innerText = notes.length;
        
        if (langIsIt) {
            viewAllBtn.innerText = 'Tutte le note';
            viewFoldersBtn.innerText = 'Cartelle';
            searchInput.placeholder = 'Cerca nota o contenuto...';
        } else {
            viewAllBtn.innerText = 'All Notes';
            viewFoldersBtn.innerText = 'Folders';
            searchInput.placeholder = 'Search note or content...';
        }

        function renderList() {
            listContainer.innerHTML = '';

            if (currentActiveView === 'folders') {
                // Render list of Folders
                if (folders.length === 0) {
                    listContainer.innerHTML = \`<div class="text-center py-8 text-zinc-500 font-medium text-sm">
                        \${langIsIt ? 'Nessuna cartella trovata' : 'No folders found'}
                    </div>\`;
                    return;
                }

                folders.forEach(folder => {
                    const count = notes.filter(n => n.folderId === folder.id).length;
                    const folderEl = document.createElement('div');
                    folderEl.className = 'bg-zinc-800/40 hover:bg-zinc-800 border border-zinc-800 rounded-xl p-3.5 flex items-center justify-between cursor-pointer transition-colors';
                    folderEl.innerHTML = \`
                        <div class="flex items-center gap-2.5">
                            <span class="text-yellow-500">
                                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
                                </svg>
                            </span>
                            <span class="font-medium text-zinc-100 text-sm">\${folder.name}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">\${count}</span>
                            <span class="text-zinc-500">
                                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
                            </span>
                        </div>
                    \`;
                    folderEl.onclick = () => {
                        currentSelectedFolderId = folder.id;
                        currentActiveView = 'all';
                        viewAllBtn.className = "flex-1 text-center text-xs py-1.5 rounded-lg font-medium bg-yellow-500 text-zinc-950 transition-colors";
                        viewFoldersBtn.className = "flex-1 text-center text-xs py-1.5 rounded-lg font-medium text-zinc-400 hover:text-zinc-200 transition-colors";
                        renderList();
                    };
                    listContainer.appendChild(folderEl);
                });
            } else {
                // Filter notes matching parameters
                let filtered = notes;
                if (currentSelectedFolderId) {
                    filtered = filtered.filter(n => n.folderId === currentSelectedFolderId);
                }
                
                if (searchKeyword.trim() !== '') {
                    const kw = searchKeyword.toLowerCase();
                    filtered = filtered.filter(n => 
                        n.title.toLowerCase().includes(kw) || 
                        n.content.toLowerCase().includes(kw)
                    );
                }

                // If folder filter is active, add clear tag filter
                if (currentSelectedFolderId) {
                    const currentFolder = folders.find(f => f.id === currentSelectedFolderId);
                    const name = currentFolder ? currentFolder.name : 'Folder';
                    const clearTag = document.createElement('div');
                    clearTag.className = 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between';
                    clearTag.innerHTML = \`
                        <span>Cartella: \${name}</span>
                        <button class="font-bold underline" onclick="clearFolderFilter()">Azzera filtro</button>
                    \`;
                    listContainer.appendChild(clearTag);
                }

                if (filtered.length === 0) {
                    listContainer.innerHTML += \`<div id="empty-state" class="text-zinc-500 text-center py-10 text-sm">
                        \${langIsIt ? 'Nessuna nota trovata' : 'No notes found'}
                    </div>\`;
                    return;
                }

                // Sort pinned first, then date desc
                const sorted = [...filtered].sort((a, b) => {
                    if (a.pinned && !b.pinned) return -1;
                    if (!a.pinned && b.pinned) return 1;
                    return b.updatedAt - a.updatedAt;
                });

                sorted.forEach(note => {
                    const dateStr = new Date(note.updatedAt).toLocaleDateString(settings.language === 'it' ? 'it-IT' : 'en-US', {
                        day: 'numeric', month: 'short'
                    });
                    
                    const folderObj = folders.find(f => f.id === note.folderId);
                    const folderName = folderObj ? folderObj.name : 'Personale';

                    const item = document.createElement('div');
                    item.className = 'bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 hover:bg-zinc-800/80 cursor-pointer transition';
                    item.innerHTML = \`
                        <div class="flex items-start justify-between gap-2">
                            <div class="flex-grow min-w-0">
                                <div class="flex items-center gap-1.5 flex-wrap">
                                    \${note.pinned ? '<span class="text-yellow-500 text-xs font-bold uppercase select-none flex items-center gap-0.5"><svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/></svg>Pin</span>' : ''}
                                    \${note.passwordLocked ? '<span class="text-red-400 text-xs font-bold">&#128274; Lock</span>' : ''}
                                    <h3 class="font-semibold text-zinc-100 text-sm truncate">\${note.title || 'Senza Titolo'}</h3>
                                </div>
                                <p class="text-zinc-400 text-xs mt-1 truncate">\${note.content.replace(/<[^>]*>/g, '') || 'Nessun contenuto'}</p>
                                <div class="flex items-center gap-2 mt-2">
                                    <span class="text-[10px] text-zinc-500 font-medium">\${dateStr}</span>
                                    <span class="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full font-medium">\${folderName}</span>
                                </div>
                            </div>
                            \${note.attachments && note.attachments.length > 0 ? \`
                            <div class="w-10 h-10 rounded-lg bg-zinc-800 overflow-hidden shrink-0 flex items-center justify-center text-zinc-500 text-sm">
                                \${getAttachmentIcon(note.attachments[0])}
                            </div>\` : ''}
                        </div>
                    \`;
                    item.onclick = () => openNote(note);
                    listContainer.appendChild(item);
                });
            }
        }

        window.clearFolderFilter = function() {
            currentSelectedFolderId = null;
            renderList();
        }

        function getAttachmentIcon(att) {
            if (att.type === 'image') return '<img src="' + att.url + '" class="w-full h-full object-cover" />';
            if (att.type === 'video') return '&#9654;'; // Play icon
            if (att.type === 'audio') return '&#127914;'; // Mic
            return '&#128196;'; // File paper
        }

        function openNote(note) {
            // Password unlock guard
            if (note.passwordLocked) {
                const pass = prompt(langIsIt ? "Inserisci la password per sbloccare questa nota:" : "Enter password to unlock note:");
                if (pass !== note.password) {
                    alert(langIsIt ? "Password non corretta!" : "Wrong password!");
                    return;
                }
            }

            selectedPreviewNote = note;
            previewTitle.innerText = note.title || 'Senza Titolo';
            
            const folderObj = folders.find(f => f.id === note.folderId);
            previewFolder.innerText = folderObj ? folderObj.name : 'Cartella';
            
            previewDate.innerText = new Date(note.updatedAt).toLocaleString(settings.language === 'it' ? 'it-IT' : 'en-US');
            
            // Set note text body HTML content
            previewBody.innerHTML = note.content || '<p class="text-zinc-500 italic">Nessun testo contenuto.</p>';
            
            // Render specific style selectors dynamically
            applyCustomThemeStyles();

            // Set up note attachments
            previewAttachmentsGrid.innerHTML = '';
            if (note.attachments && note.attachments.length > 0) {
                previewAttachmentsSection.classList.remove('hidden');
                note.attachments.forEach(att => {
                    const el = document.createElement('div');
                    el.className = 'bg-zinc-800/80 p-3 rounded-xl border border-zinc-700/60 flex items-center gap-3 justify-between';
                    
                    let mediaRender = '';
                    if (att.type === 'image') {
                        mediaRender = \`
                            <div class="flex-grow">
                                <img src="\${att.url}" class="w-32 rounded-lg max-h-32 object-contain cursor-pointer border border-zinc-700" onclick="showFullImg('\${att.url}')"/>
                                <span class="text-[10px] text-zinc-400 block mt-1">\${att.name || 'Immagine'}</span>
                            </div>
                        \`;
                    } else if (att.type === 'video') {
                        mediaRender = \`
                            <div class="flex-grow space-y-1">
                                <video src="\${att.url}" controls class="w-full rounded-lg max-h-48 border border-zinc-700 bg-black"></video>
                                <span class="text-[10px] text-zinc-400 block font-mono">\${att.name}</span>
                            </div>
                        \`;
                    } else if (att.type === 'audio') {
                        mediaRender = \`
                            <div class="flex-grow space-y-1">
                                <audio src="\${att.url}" controls class="w-full h-8 accent-yellow-500"></audio>
                                <span class="text-[10px] text-zinc-400 block">\${att.name}</span>
                            </div>
                        \`;
                    } else if (att.type === 'drawing') {
                        mediaRender = \`
                            <div class="flex-grow">
                                <img src="\${att.url}" class="w-full bg-white rounded-lg p-1 max-h-36 object-contain cursor-pointer" onclick="showFullImg('\${att.url}')"/>
                                <span class="text-[10px] text-zinc-400 block mt-1">Disegno a mano libera</span>
                            </div>
                        \`;
                    } else if (att.type === 'chart') {
                        const dataLines = (att.chartData || []).map(kv => \`<li>\${kv.label}: <strong>\${kv.value}</strong></li>\`).join('');
                        mediaRender = \`
                            <div class="flex-grow bg-zinc-900 border border-zinc-800 p-2.5 rounded-lg">
                                <div class="text-xs font-bold text-yellow-500 flex items-center gap-1.5 mb-1.5">
                                    <span>&#128200; Grafico (\${att.chartType || 'Bar'})</span>
                                </div>
                                <ul class="text-[11px] text-zinc-400 space-y-0.5 list-disc pl-4">
                                    \${dataLines}
                                </ul>
                            </div>
                        \`;
                    } else {
                        mediaRender = \`
                            <div class="flex items-center gap-2">
                                <span class="text-yellow-500">&#128196;</span>
                                <span class="text-xs font-medium text-zinc-200 truncate max-w-[170px]">\${att.name}</span>
                            </div>
                            <a href="\${att.url}" download="\${att.name}" class="text-xs font-semibold bg-zinc-700 text-zinc-100 py-1 px-3 rounded hover:bg-zinc-650 transition">Scarica</a>
                        \`;
                    }

                    el.innerHTML = mediaRender;
                    previewAttachmentsGrid.appendChild(el);
                });
            } else {
                previewAttachmentsSection.classList.add('hidden');
            }

            // Open modal
            noteModal.classList.remove('hidden');
            setTimeout(() => {
                modalContainer.classList.remove('translate-y-full');
            }, 10);
        }

        function applyCustomThemeStyles() {
            // Font preferences
            const appFont = '${settings.fontFamily || 'system'}';
            if (appFont === 'serif') {
                previewBody.className = "text-zinc-300 font-serif space-y-3 leading-relaxed text-sm overflow-x-auto min-h-[150px]";
            } else if (appFont === 'monospace') {
                previewBody.className = "text-zinc-300 font-monospace space-y-3 leading-relaxed text-xs overflow-x-auto min-h-[150px]";
            } else if (appFont === 'handwritten') {
                previewBody.className = "text-zinc-300 font-handwritten space-y-3 leading-relaxed text-lg overflow-x-auto min-h-[150px]";
            } else {
                previewBody.className = "text-zinc-300 space-y-3 leading-relaxed text-sm overflow-x-auto min-h-[150px]";
            }

            // Adjust font size
            const size = '${settings.fontSize || 'md'}';
            if (size === 'sm') previewBody.classList.add('text-xs');
            else if (size === 'md') previewBody.classList.add('text-sm');
            else if (size === 'lg') previewBody.classList.add('text-base');
            else if (size === 'xl') previewBody.classList.add('text-lg');
        }

        window.showFullImg = function(url) {
            const wrap = document.createElement('div');
            wrap.className = 'fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 cursor-zoom-out';
            wrap.onclick = () => wrap.remove();
            
            const img = document.createElement('img');
            img.src = url;
            img.className = 'max-w-full max-h-full object-contain rounded-lg shadow-2xl';
            
            wrap.appendChild(img);
            document.body.appendChild(wrap);
        }

        // Action handles inside Modal
        closeModalBtn.onclick = () => {
            modalContainer.classList.add('translate-y-full');
            setTimeout(() => {
                noteModal.classList.add('hidden');
            }, 300);
        };

        btnCopyClipboard.onclick = () => {
            if (!selectedPreviewNote) return;
            const plainText = selectedPreviewNote.content.replace(/<[^>]*>/g, '');
            navigator.clipboard.writeText(plainText).then(() => {
                alert(langIsIt ? "Contenuto copiato negli appunti!" : "Content copied to clipboard!");
            });
        };

        btnExportTxt.onclick = () => {
            if (!selectedPreviewNote) return;
            const plainText = selectedPreviewNote.title + '\\n\\n' + selectedPreviewNote.content.replace(/<[^>]*>/g, '');
            const blob = new Blob([plainText], { type: 'text/plain;charset=utf-8' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = (selectedPreviewNote.title || 'nota') + '.txt';
            link.click();
        };

        // Views switcher event setup
        viewAllBtn.onclick = () => {
            currentSelectedFolderId = null;
            currentActiveView = 'all';
            viewAllBtn.className = "flex-1 text-center text-xs py-1.5 rounded-lg font-medium bg-yellow-500 text-zinc-950 transition-colors";
            viewFoldersBtn.className = "flex-1 text-center text-xs py-1.5 rounded-lg font-medium text-zinc-400 hover:text-zinc-200 transition-colors";
            renderList();
        };

        viewFoldersBtn.onclick = () => {
            currentActiveView = 'folders';
            viewFoldersBtn.className = "flex-1 text-center text-xs py-1.5 rounded-lg font-medium bg-yellow-500 text-zinc-950 transition-colors";
            viewAllBtn.className = "flex-1 text-center text-xs py-1.5 rounded-lg font-medium text-zinc-400 hover:text-zinc-200 transition-colors";
            renderList();
        };

        searchInput.oninput = (e) => {
            searchKeyword = e.target.value;
            renderList();
        };

        document.getElementById('help-btn').onclick = () => {
            alert(langIsIt 
                ? "Note Android Standalone App: Questa pagina locale statica contiene l'intero set di dati esportato, con ricerca integrata, navigazione cartelle e visualizzazione per allegati."
                : "Note Android Standalone App: This local self-contained package holds your exported database with search, folders list and attachments playback."
            );
        };

        // Initial launch render code execution 
        renderList();
    </script>
</body>
</html>`;
}
