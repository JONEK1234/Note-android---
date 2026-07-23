import React, { useState, useEffect, useRef } from 'react';
import { 
  FolderPlus, Plus, Search, Pin, Edit, Trash2, ArrowLeft, ChevronRight, 
  Settings as SettingsIcon, Globe, FileDown, Lock, Unlock, Copy, Check, 
  Play, Volume2, Type, Square, CheckSquare, Image as ImageIcon, 
  Video as VideoIcon, Mic, FileText, Palette, Sliders, Layout, RefreshCw, 
  ArrowUp, ArrowDown, FolderSync, ZoomIn, ZoomOut, RotateCcw, Sparkles, Bold, Italic, Underline,
  Strikethrough, Link, FileJson, Calendar, Sparkle, AlignJustify, Paperclip, Home,
  Maximize, Minimize, Columns
} from 'lucide-react';
import { Note, Folder, AppSettings, Attachment } from './types';
import DrawingCanvas from './components/DrawingCanvas';
import { mdToHtml, htmlToMd } from './utils/markdown';
import { generateStandaloneHtml } from './utils/exporter';
import JSZip from 'jszip';

// Default mock structures 
const DEFAULT_FOLDERS: Folder[] = [
  { id: 'f-all', name: 'Tutte le note / All Notes', pinned: true, isSystem: true },
  { id: 'f-notes', name: 'Note Personali', pinned: true },
  { id: 'f-work', name: 'Lavoro', pinned: false },
  { id: 'f-drawings', name: 'Disegni e Grafici', pinned: false },
];

const DEFAULT_NOTES: Note[] = [
  {
    id: 'note-1',
    folderId: 'f-notes',
    title: 'Benvenuto in Note Android! 🌟',
    content: `
      <h1 class="text-2xl font-bold tracking-tight mb-2">Clone Premium di Note di iPhone</h1>
      <p class="mb-2">Benvenuto nel tuo nuovo taccuino digitale ad altissima fedeltà, interamente concepito per rispecchiare l'esperienza intima di <span style="color: #E5A93C">Note di iOS</span> sul tuo smartphone Android!</p>
      
      <h2 class="text-xl font-bold mt-3 mb-2">🎨 Personalizzazione Unica dei Colori</h2>
      <p class="mb-2">Questo editor ti consente di <strong style="color: #e11d48">colorare singole parole</strong>, frasi o interi paragrafi. Prova a selezionare del testo: apparirà una barra mobile per applicare qualsiasi tonalità con la ruota colori o codici HEX.</p>
      
      <h3 class="text-lg font-bold mt-3 mb-1">🚀 Funzionalità di Spicco</h3>
      <p class="mb-1">Tutto è salvato in locale al volo! Puoi inserire:</p>
      <li class="list-disc ml-4 my-1">Disegni a mano libera realizzati sullo schermo</li>
      <li class="list-disc ml-4 my-1">Grafici a barre, a torta o a linee dinamici</li>
      <li class="list-disc ml-4 my-1">Collegamenti a link esterni (con o senza anteprima), tracce audio e foto</li>
      
      <p class="mt-3">Goditi un layout distensivo e pulito con caratteri modulabili!</p>
    `,
    pinned: true,
    passwordLocked: false,
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now() - 3600000,
    attachments: [
      {
        id: 'att-sample-1',
        type: 'chart',
        name: 'Andamento Produttività',
        url: '',
        chartType: 'bar',
        chartData: [
          { label: 'Lun', value: 80 },
          { label: 'Mar', value: 95 },
          { label: 'Mer', value: 60 },
          { label: 'Gio', value: 100 },
          { label: 'Ven', value: 85 }
        ]
      }
    ]
  },
  {
    id: 'note-2',
    folderId: 'f-notes',
    title: 'Cose da fare oggi 🛒',
    content: `
      <h2>Lista Checklist Interattiva</h2>
      <p>Organizza la giornata con punti spuntabili al tocco:</p>
      <div class="flex items-start my-1"><input type="checkbox" checked class="w-5 h-5 rounded border-zinc-700 text-yellow-500 mr-2 accent-yellow-500 mt-1" /> <span>Comprare il pane fresco</span></div>
      <div class="flex items-start my-1"><input type="checkbox" class="w-5 h-5 rounded border-zinc-700 text-yellow-500 mr-2 accent-yellow-500 mt-1" /> <span>Rinnovare abbonamento palestra</span></div>
      <div class="flex items-start my-1"><input type="checkbox" class="w-5 h-5 rounded border-zinc-700 text-yellow-500 mr-2 accent-yellow-500 mt-1" /> <span>Inviare report settimanale a Luca</span></div>
      <p class="mt-2"></p>
    `,
    pinned: false,
    passwordLocked: false,
    createdAt: Date.now() - 7200000,
    updatedAt: Date.now() - 7200000,
    attachments: []
  }
];

const DEFAULT_SETTINGS: AppSettings = {
  language: 'it',
  primaryColor: '#E5A93C', // iPhone default signature mustard/gold
  fontSize: 'md',
  fontFamily: 'system',
  launchFolderId: 'f-all',
  linedPaper: false
};

const COLOR_PRESETS = [
  '#000000', // Nero
  '#ffffff', // Bianco
  '#E5A93C', // iOS Yellow
  '#ef4444', // Red
  '#3b82f6', // Blue
  '#22c55e', // Green
  '#a855f7', // Purple
  '#f97316', // Orange
];

// Dynamic Excel-style formula evaluation helper
export const evaluateExcelCell = (rawValue: string, allCells: string[][]): string => {
  if (!rawValue || !rawValue.startsWith('=')) return rawValue;
  try {
    const formula = rawValue.substring(1).toUpperCase().trim();
    
    if (formula.startsWith('SUM(') && formula.endsWith(')')) {
      const rangeStr = formula.substring(4, formula.length - 1).trim();
      if (rangeStr.includes(':')) {
        const [start, end] = rangeStr.split(':').map(s => s.trim());
        const startCol = start.charCodeAt(0) - 65;
        const startRow = parseInt(start.substring(1)) - 1;
        const endCol = end.charCodeAt(0) - 65;
        const endRow = parseInt(end.substring(1)) - 1;
        let sum = 0;
        for (let r = Math.min(startRow, endRow); r <= Math.max(startRow, endRow); r++) {
          for (let c = Math.min(startCol, endCol); c <= Math.max(startCol, endCol); c++) {
            const raw = allCells[r]?.[c] || '0';
            const val = parseFloat(raw.startsWith('=') ? evaluateExcelCell(raw, allCells) : raw.replace(/[^\d.-]/g, ''));
            if (!isNaN(val)) sum += val;
          }
        }
        return sum.toString();
      } else {
        const parts = rangeStr.split(',');
        let sum = 0;
        for (const p of parts) {
          const trimmed = p.trim();
          const col = trimmed.charCodeAt(0) - 65;
          const row = parseInt(trimmed.substring(1)) - 1;
          const raw = allCells[row]?.[col] || '0';
          const val = parseFloat(raw.startsWith('=') ? evaluateExcelCell(raw, allCells) : raw.replace(/[^\d.-]/g, ''));
          if (!isNaN(val)) sum += val;
        }
        return sum.toString();
      }
    }

    if (formula.startsWith('AVERAGE(') && formula.endsWith(')')) {
      const rangeStr = formula.substring(8, formula.length - 1).trim();
      if (rangeStr.includes(':')) {
        const [start, end] = rangeStr.split(':').map(s => s.trim());
        const startCol = start.charCodeAt(0) - 65;
        const startRow = parseInt(start.substring(1)) - 1;
        const endCol = end.charCodeAt(0) - 65;
        const endRow = parseInt(end.substring(1)) - 1;
        let sum = 0;
        let count = 0;
        for (let r = Math.min(startRow, endRow); r <= Math.max(startRow, endRow); r++) {
          for (let c = Math.min(startCol, endCol); c <= Math.max(startCol, endCol); c++) {
            const raw = allCells[r]?.[c] || '0';
            const val = parseFloat(raw.startsWith('=') ? evaluateExcelCell(raw, allCells) : raw.replace(/[^\d.-]/g, ''));
            if (!isNaN(val)) {
              sum += val;
              count++;
            }
          }
        }
        return count > 0 ? (sum / count).toFixed(2).replace(/\.00$/, '') : '0';
      }
    }

    const mathRegex = /^([A-Z])(\d+)\s*([\+\-\*\/])\s*([A-Z])(\d+)$/;
    const match = formula.replace(/\s+/g, '').match(mathRegex);
    if (match) {
      const col1 = match[1].charCodeAt(0) - 65;
      const row1 = parseInt(match[2]) - 1;
      const op = match[3];
      const col2 = match[4].charCodeAt(0) - 65;
      const row2 = parseInt(match[5]) - 1;
      
      const raw1 = allCells[row1]?.[col1] || '0';
      const raw2 = allCells[row2]?.[col2] || '0';
      
      const val1 = parseFloat(raw1.startsWith('=') ? evaluateExcelCell(raw1, allCells) : raw1.replace(/[^\d.-]/g, ''));
      const val2 = parseFloat(raw2.startsWith('=') ? evaluateExcelCell(raw2, allCells) : raw2.replace(/[^\d.-]/g, ''));
      
      if (!isNaN(val1) && !isNaN(val2)) {
        if (op === '+') return (val1 + val2).toString();
        if (op === '-') return (val1 - val2).toString();
        if (op === '*') return (val1 * val2).toString();
        if (op === '/') return val2 !== 0 ? (val1 / val2).toFixed(2).replace(/\.00$/, '') : 'Err/0';
      }
    }
  } catch (e) {
    console.error("Formula error:", e);
    return 'Err!';
  }
  return rawValue;
};

export default function App() {
  // --- STATE ---
  const [folders, setFolders] = useState<Folder[]>(() => {
    const injected = (window as any).__INITIAL_FOLDERS__;
    if (injected && Array.isArray(injected)) {
      localStorage.setItem('android_notes_folders', JSON.stringify(injected));
      return injected;
    }
    const saved = localStorage.getItem('android_notes_folders');
    return saved ? JSON.parse(saved) : DEFAULT_FOLDERS;
  });

  const [notes, setNotes] = useState<Note[]>(() => {
    const injected = (window as any).__INITIAL_NOTES__;
    if (injected && Array.isArray(injected)) {
      localStorage.setItem('android_notes_notes', JSON.stringify(injected));
      return injected;
    }
    const saved = localStorage.getItem('android_notes_notes');
    return saved ? JSON.parse(saved) : DEFAULT_NOTES;
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    const injected = (window as any).__INITIAL_SETTINGS__;
    if (injected && typeof injected === 'object' && injected !== null) {
      localStorage.setItem('android_notes_settings', JSON.stringify(injected));
      return injected;
    }
    const saved = localStorage.getItem('android_notes_settings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  const [currentView, setCurrentView] = useState<'folders' | 'notes-list' | 'editor' | 'settings'>(() => {
    // start with launch default folder if possible
    return 'folders';
  });

  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [currentNoteId, setCurrentNoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Custom dialog or transient states
  const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState(false);
  const [folderNameInput, setFolderNameInput] = useState('');
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  
  // Drawing Canvas
  const [isDrawingOpen, setIsDrawingOpen] = useState(false);

  // Note Tap-and-Hold / Long Press Context Menu State
  const [contextMenuNote, setContextMenuNote] = useState<Note | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressActiveRef = useRef<boolean>(false);
  const editorTimeoutRef = useRef<any>(null);

  // Folder Tap-and-Hold / Long Press Context Menu State
  const [contextMenuFolder, setContextMenuFolder] = useState<Folder | null>(null);
  const folderLongPressTimerRef = useRef<any>(null);
  const isFolderLongPressActiveRef = useRef<boolean>(false);
  const [folderDescriptionInput, setFolderDescriptionInput] = useState('');
  const [folderShowDescriptionInput, setFolderShowDescriptionInput] = useState(false);
  
  // Custom text color selections
  const [selectionColor, setSelectionColor] = useState('#E5A93C');
  const [recentHighlightColors, setRecentHighlightColors] = useState<string[]>(() => {
    const saved = localStorage.getItem('android_notes_recent_colors');
    return saved ? JSON.parse(saved) : ['#E2B13C', '#ef4444', '#3b82f6', '#22c55e', '#a855f7'];
  });
  const [recentPrimaryColors, setRecentPrimaryColors] = useState<string[]>(() => {
    const saved = localStorage.getItem('android_notes_recent_primary_colors');
    return saved ? JSON.parse(saved) : ['#E5A93C', '#ef4444', '#3b82f6', '#22c55e', '#a855f7'];
  });
  const [selectionRange, setSelectionRange] = useState<Range | null>(null);
  const [showColorSelectionMenu, setShowColorSelectionMenu] = useState(false);
  const [floatingMenuCoord, setFloatingMenuCoord] = useState({ top: 0, left: 0 });
  const [selectionTextCached, setSelectionTextCached] = useState('');

  // Point-to-Point boundary points selection
  const [startSelectionBoundary, setStartSelectionBoundary] = useState<{
    node: Node;
    offset: number;
    textPreview: string;
  } | null>(null);
  const [selectionMessage, setSelectionMessage] = useState<string | null>(null);

  // Password Lock state
  const [lockPromptOpen, setLockPromptOpen] = useState(false);
  const [lockPasswordInput, setLockPasswordInput] = useState('');
  const [lockingNoteId, setLockingNoteId] = useState<string | null>(null);
  const [unlockNoteIdTarget, setUnlockNoteIdTarget] = useState<string | null>(null);
  const [unlockPasswordInput, setUnlockPasswordInput] = useState('');
  const [unlockedSessionKeys, setUnlockedSessionKeys] = useState<Record<string, boolean>>({});

  // Charts builder modal state
  const [chartBuilderOpen, setChartBuilderOpen] = useState(false);
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie' | 'table'>('bar');
  const [chartTitle, setChartTitle] = useState('Nuovo Grafico');
  const [chartItems, setChartItems] = useState<{ label: string; value: number; color?: string }[]>([
    { label: '', value: 0 },
    { label: '', value: 0 },
    { label: '', value: 0 },
  ]);
  const [tableCells, setTableCells] = useState<string[][]>([
    ['', '', ''],
    ['', '', ''],
    ['', '', ''],
  ]);
  const [tableMarkdown, setTableMarkdown] = useState<string>('');
  const [tableStyles, setTableStyles] = useState<{
    rowColors?: { [rowIdx: number]: string };
    colColors?: { [colIdx: number]: string };
    cellColors?: { [cellKey: string]: string };
    textColors?: { [cellKey: string]: string };
    rowTextColors?: { [rowIdx: number]: string };
    colTextColors?: { [colIdx: number]: string };
  }>({});
  const [colorPickerIndex, setColorPickerIndex] = useState<number | null>(null);
  const [activeTableStyleTarget, setActiveTableStyleTarget] = useState<{
    type: 'cell' | 'row' | 'col';
    rIdx: number;
    cIdx: number;
  }>({ type: 'cell', rIdx: 0, cIdx: 0 });
  const [colorMode, setColorMode] = useState<'text' | 'bg'>('text');

  // Link builder modal state
  const [linkBuilderOpen, setLinkBuilderOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [linkShowPreview, setLinkShowPreview] = useState(false);

  // Fullscreen images/videos/charts/tables modal
  const [fullscreenMediaUrl, setFullscreenMediaUrl] = useState<string | null>(null);
  const [fullscreenMediaType, setFullscreenMediaType] = useState<'image' | 'video' | 'table' | 'chart' | null>(null);
  const [fullscreenTableData, setFullscreenTableData] = useState<string[][] | null>(null);
  const [fullscreenTableStyles, setFullscreenTableStyles] = useState<any | null>(null);
  const [fullscreenChartType, setFullscreenChartType] = useState<'bar' | 'line' | 'pie' | null>(null);
  const [fullscreenChartItems, setFullscreenChartItems] = useState<{ label: string; value: number; color?: string }[]>([]);
  const [fullscreenChartName, setFullscreenChartName] = useState<string>('Grafico');

  // Custom confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmText: string;
    cancelText: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  } | null>(null);

  // Folder selection modal to move notes
  const [moveNoteFolderModalOpen, setMoveNoteFolderModalOpen] = useState(false);
  const [movingNoteId, setMovingNoteId] = useState<string | null>(null);

  // Parent configuration for nested folders
  const [folderParentIdInput, setFolderParentIdInput] = useState<string>('');

  // Description Edit Modal Open Status
  const [isDescriptionEditOpen, setIsDescriptionEditOpen] = useState(false);

  // Recent colors used in table palette
  const [recentTableColors, setRecentTableColors] = useState<string[]>(() => {
    const saved = localStorage.getItem('android_notes_recent_table_colors');
    return saved ? JSON.parse(saved) : ['#E5A93C', '#3B82F6', '#10B981', '#EF4444', '#8B5CF6'];
  });

  // Temporary feedback toast when default launch folder is modified
  const [launchFeedbackMessage, setLaunchFeedbackMessage] = useState<string | null>(null);

  // Markdown paste status alerts
  const [showMarkdownImportAlert, setShowMarkdownImportAlert] = useState(false);
  const [pastedMarkdownString, setPastedMarkdownString] = useState('');
  const [showEditorMarkdownImport, setShowEditorMarkdownImport] = useState(false);
  const [editorMarkdownString, setEditorMarkdownString] = useState('');

  // Rename & Custom Preview modal state
  const [isRenamePreviewModalOpen, setIsRenamePreviewModalOpen] = useState(false);
  const [renamePreviewNoteId, setRenamePreviewNoteId] = useState<string | null>(null);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteCustomPreview, setNewNoteCustomPreview] = useState('');
  const [isWidgetEditing, setIsWidgetEditing] = useState(false);
  const [editingChartId, setEditingChartId] = useState<string | null>(null);

  // Download whole app offline modal and packing state
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);
  const [isPackingApp, setIsPackingApp] = useState(false);

  // Wide layout mode for expansive screen note viewing (Desktop Site Mode)
  const [isWideLayout, setIsWideLayout] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('android_notes_wide_layout');
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  // Desktop site zoom scale level and auto-fit state
  const [windowWidth, setWindowWidth] = useState<number>(() => typeof window !== 'undefined' ? window.innerWidth : 1024);
  const [desktopZoomScale, setDesktopZoomScale] = useState<number>(1);
  const [autoFitDesktop, setAutoFitDesktop] = useState<boolean>(true);

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Compute actual desktop scale factor (auto-fit or custom zoom level)
  const calculatedAutoScale = Math.max(0.35, Math.min(1.2, (windowWidth - 8) / 1024));
  const effectiveDesktopScale = autoFitDesktop && windowWidth < 1024 ? calculatedAutoScale : desktopZoomScale;

  useEffect(() => {
    try {
      localStorage.setItem('android_notes_wide_layout', JSON.stringify(isWideLayout));
    } catch {}
  }, [isWideLayout]);

  // Keyboard height tracker for soft virtual keyboard
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [visualViewportHeight, setVisualViewportHeight] = useState<number | null>(() => {
    if (typeof window !== 'undefined' && window.visualViewport) {
      return window.visualViewport.height;
    }
    return null;
  });

  const addRecentTableColor = (hex: string) => {
    if (!hex) return;
    setRecentTableColors(prev => {
      const filtered = prev.filter(c => c.toLowerCase() !== hex.toLowerCase());
      const next = [hex, ...filtered].slice(0, 10);
      localStorage.setItem('android_notes_recent_table_colors', JSON.stringify(next));
      return next;
    });
  };

  const getNotesCountRecursively = (folderId: string): number => {
    if (folderId === 'f-all') return notes.length;
    let count = notes.filter(n => n.folderId === folderId).length;
    
    const getChildrenIds = (parentId: string): string[] => {
      const children = folders.filter(f => f.parentId === parentId);
      let ids = children.map(c => c.id);
      children.forEach(c => {
        ids = [...ids, ...getChildrenIds(c.id)];
      });
      return ids;
    };
    
    const childIds = getChildrenIds(folderId);
    childIds.forEach(cId => {
      count += notes.filter(n => n.folderId === cId).length;
    });
    return count;
  };

  const getFlattenedFolders = (): { folder: Folder, depth: number }[] => {
    const nonSystem = folders.filter(f => !f.isSystem);
    const result: { folder: Folder, depth: number }[] = [];
    
    const visit = (parentId: string | undefined, currentDepth: number) => {
      const children = nonSystem.filter(f => f.parentId === parentId);
      children.forEach(child => {
        result.push({ folder: child, depth: currentDepth });
        visit(child.id, currentDepth + 1);
      });
    };
    
    const rootFolders = nonSystem.filter(f => !f.parentId || !nonSystem.some(p => p.id === f.parentId));
    rootFolders.forEach(rf => {
      result.push({ folder: rf, depth: 0 });
      visit(rf.id, 1);
    });
    
    return result;
  };

  // Refs
  const editorRef = useRef<HTMLDivElement>(null);
  const attachmentsPanelRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef<Note[]>(notes);
  notesRef.current = notes;
  const handleStartEditChartWidgetRef = useRef<any>(null);

  // --- LOCALIZATION DICTIONARY ---
  const TRANSLATIONS = {
    it: {
      folders: 'Cartelle',
      searchPlaceholder: 'Cerca nota o contenuto...',
      allNotes: 'Tutte le note',
      notesCount: 'note',
      noNotes: 'Nessuna nota trovata',
      foldersTitle: 'Cartelle',
      pinnedFolders: 'CARTELLE FISSATE',
      otherFolders: 'ALTRE CARTELLE',
      unnamedNote: 'Nota senza titolo',
      createNote: 'Crea Nota',
      emptyNoteBody: 'Inizia a scrivere qui la tua nota...',
      settings: 'Impostazioni',
      language: 'Lingua d\'uso',
      primaryColor: 'Colore principale applicazione',
      fontSize: 'Dimensione caratteri editor',
      fontFamily: 'Stile carattere editor',
      defaultFolder: 'Cartella di lancio predefinita',
      pin: 'Fissa in alto',
      unpin: 'Rimuovi evidenza',
      lock: 'Proteggi Nota',
      unlock: 'Sblocca Nota',
      locked: 'Nota protetta da password',
      duplicate: 'Duplica',
      move: 'Sposta di cartella',
      delete: 'Elimina',
      pinnedNotes: 'IN EVIDENZA',
      recentNotes: 'NOTE RECENTI',
      deleteFolderPrompt: 'Sicuro di voler eliminare questa cartella? Tutte le note contenute verranno perse.',
      cantDeleteAll: 'Non puoi eliminare le cartelle di sistema!',
      newFolder: 'Nuova Cartella',
      folderName: 'Nome Cartella',
      save: 'Salva',
      cancel: 'Annulla',
      markdownSuccess: 'Markdown incollato e convertito con successo!',
      convertMdButton: 'Importa Markdown da ChatGPT',
      exportHtmlButton: 'Esporta Note Android.html',
      exportTxt: 'Esporta in TXT',
      exportJson: 'Esporta Info Note (JSON)',
      importMdTitle: 'Incolla testo Markdown qui',
      drawingBtn: 'Disegno',
      chartBtn: 'Grafico',
      fileBtn: 'Allega File',
      imageBtn: 'Foto/Video',
      linkBtn: 'Link',
      back: 'Indietro',
      passwordRequired: 'Questa nota richiede una Password d\'accesso',
      enterPassword: 'Password d\'accesso',
      setPassword: 'Imposta una password di sblocco per questa nota:',
      wrongPassword: 'Password errata!',
      chartBuilder: 'Generatore di Grafici Integrato',
      addChartRow: 'Aggiungi Riga',
      chartTypeLabel: 'Tipo di Grafico',
      label: 'Voce',
      value: 'Valore',
      insert: 'Inserisci Grafico',
      moveNoteTo: 'Sposta la nota in:',
      editFolder: 'Rinomina Cartella',
      fontStyleSystem: 'Sistema (Predefinito)',
      fontStyleSerif: 'Editore Elegante (Serif)',
      fontStyleMono: 'Sviluppatore (Monospace)',
      fontStyleHand: 'Scritto a Mano (Handwritten)',
      linedPaperSetting: 'Righi nel foglio delle note (Predefinito)',
      toggleLinedPaper: 'Attiva/Disattiva righi',
      pointToPointSelection: 'Selezione Punto-Punto 📍',
      setStartPoint: 'Imposta Inizio [A]',
      setEndPoint: 'Imposta Fine [B]',
    },
    en: {
      folders: 'Folders',
      searchPlaceholder: 'Search notes or content...',
      allNotes: 'All Notes',
      notesCount: 'notes',
      noNotes: 'No notes found',
      foldersTitle: 'Folders',
      pinnedFolders: 'PINNED FOLDERS',
      otherFolders: 'FOLDERS',
      unnamedNote: 'Untitled note',
      createNote: 'Create Note',
      emptyNoteBody: 'Start writing your note here...',
      settings: 'Settings',
      language: 'App Language',
      primaryColor: 'Primary App Color',
      fontSize: 'Editor Font Size',
      fontFamily: 'Editor Font Style',
      defaultFolder: 'Default Launch Folder',
      pin: 'Pin Note',
      unpin: 'Unpin Note',
      lock: 'Lock Note',
      unlock: 'Unlock Note',
      locked: 'Locked note',
      duplicate: 'Duplicate',
      move: 'Move Note',
      delete: 'Delete',
      pinnedNotes: 'PINNED',
      recentNotes: 'RECENT NOTES',
      deleteFolderPrompt: 'Are you sure you want to delete this folder? All contained notes will be permanently lost.',
      cantDeleteAll: 'System folders cannot be deleted!',
      newFolder: 'New Folder',
      folderName: 'Folder Name',
      save: 'Save',
      cancel: 'Cancel',
      markdownSuccess: 'Markdown pasted and converted successfully!',
      convertMdButton: 'Import Markdown from ChatGPT',
      exportHtmlButton: 'Export Note Android.html',
      exportTxt: 'Export as TXT',
      exportJson: 'Export Note Details (JSON)',
      importMdTitle: 'Paste Markdown text here',
      drawingBtn: 'Sketch',
      chartBtn: 'Add Chart',
      fileBtn: 'Attach File',
      imageBtn: 'Attach Media',
      linkBtn: 'Web Link',
      back: 'Back',
      passwordRequired: 'This note is password protected',
      enterPassword: 'Enter Access Password',
      setPassword: 'Set an access password for this note:',
      wrongPassword: 'Wrong password!',
      chartBuilder: 'Integrated Chart Builder',
      addChartRow: 'Add Row',
      chartTypeLabel: 'Chart Template',
      label: 'Label',
      value: 'Value',
      insert: 'Insert Chart',
      moveNoteTo: 'Move note to folder:',
      editFolder: 'Rename Folder',
      fontStyleSystem: 'System Sans',
      fontStyleSerif: 'Editorial Book (Serif)',
      fontStyleMono: 'Developer (Monospace)',
      fontStyleHand: 'Handwritten Script',
      linedPaperSetting: 'Lined paper inside notes (Default)',
      toggleLinedPaper: 'Toggle lined paper lines',
      pointToPointSelection: 'Point-to-Point Selection 📍',
      setStartPoint: 'Set Start Point [A]',
      setEndPoint: 'Set End Point [B]',
    }
  };

  const t = TRANSLATIONS[settings.language];

  // --- SAVE DATA SIDE EFFECTS ---
  useEffect(() => {
    try {
      localStorage.setItem('android_notes_folders', JSON.stringify(folders));
    } catch (e) {
      console.warn("Storage warning: Local folders storage is full", e);
    }
  }, [folders]);

  useEffect(() => {
    // Debounce state serialization to localStorage to maintain 120 FPS liquid-smooth typing, keeping CPU/Disk IO separate from core interactive loops
    const saveTimer = setTimeout(() => {
      try {
        localStorage.setItem('android_notes_notes', JSON.stringify(notes));
      } catch (e) {
        console.error("Storage error: Local notes storage is full (quota exceeded)", e);
      }
    }, 1500); // 1.5 seconds cooldown allows typing and layout calculation to flow at maximum speed

    return () => clearTimeout(saveTimer);
  }, [notes]);

  useEffect(() => {
    try {
      localStorage.setItem('android_notes_settings', JSON.stringify(settings));
    } catch (e) {
      console.warn("Storage warning: Local settings storage is full", e);
    }
  }, [settings]);

  // Handle default startup folder on mount
  useEffect(() => {
    if (settings.launchFolderId && settings.launchFolderId !== 'all') {
      const exists = folders.some(f => f.id === settings.launchFolderId);
      if (exists) {
        setSelectedFolderId(settings.launchFolderId);
        setCurrentView('notes-list');
      }
    }
  }, []);

  // Monitor the visual viewport height changes to detect physical/virtual mobile keyboards
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const handleVisualViewportChange = () => {
      const vv = window.visualViewport;
      if (!vv) return;

      setVisualViewportHeight(vv.height);

      // Force layout window scroll reset to prevent iOS Safari from panning the page up
      if (vv.offsetTop > 0) {
        window.scrollTo(0, 0);
      }

      // In modern mobile web pages, window.innerHeight represents the standard layout viewport.
      // vv.height represents the actual available visible rendering space of the screen.
      // The offset represents the size of the virtual keyboard or any hardware controller dock.
      const offset = window.innerHeight - vv.height;
      
      // A threshold of 60px screens out standard notches, home indicators, or browser adress-bars.
      if (offset > 60) {
        setKeyboardHeight(offset);
      } else {
        setKeyboardHeight(0);
      }
    };

    window.visualViewport.addEventListener('resize', handleVisualViewportChange);
    window.visualViewport.addEventListener('scroll', handleVisualViewportChange);

    return () => {
      window.visualViewport?.removeEventListener('resize', handleVisualViewportChange);
      window.visualViewport?.removeEventListener('scroll', handleVisualViewportChange);
    };
  }, []);

  // Fullscreen state and handler
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFSChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFSChange);
    document.addEventListener('webkitfullscreenchange', handleFSChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFSChange);
      document.removeEventListener('webkitfullscreenchange', handleFSChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      const docEl = document.documentElement as any;
      const requestFS = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.mozRequestFullScreen || docEl.msRequestFullscreen;
      if (requestFS) {
        requestFS.call(docEl).then(() => setIsFullscreen(true)).catch(() => {});
      }
    } else {
      const doc = document as any;
      const exitFS = doc.exitFullscreen || doc.webkitExitFullscreen || doc.mozCancelFullScreen || doc.msExitFullscreen;
      if (exitFS) {
        exitFS.call(doc).then(() => setIsFullscreen(false)).catch(() => {});
      }
    }
  };

  // Request fullscreen mode automatically when entering the site or on first interaction
  useEffect(() => {
    const enterFullscreen = () => {
      if (!document.fullscreenElement) {
        const docEl = document.documentElement as any;
        const requestFS = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.mozRequestFullScreen || docEl.msRequestFullscreen;
        if (requestFS) {
          requestFS.call(docEl).catch(() => {});
        }
      }
    };

    enterFullscreen();

    const handleFirstInteraction = () => {
      enterFullscreen();
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };

    window.addEventListener('click', handleFirstInteraction);
    window.addEventListener('touchstart', handleFirstInteraction);

    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, []);

  // Synchronize editor innerHTML safely without destroying cursors
  const lastLoadedNoteIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (currentView === 'editor' && currentNoteId && editorRef.current) {
      if (lastLoadedNoteIdRef.current !== currentNoteId) {
        const active = notes.find(n => n.id === currentNoteId);
        if (active) {
          editorRef.current.innerHTML = active.content;
        }
        lastLoadedNoteIdRef.current = currentNoteId;
      }
    } else if (currentView !== 'editor') {
      lastLoadedNoteIdRef.current = null;
    }
  }, [currentNoteId, currentView]);

  // Autosave note changes whenever navigating away, closing can/or transitioning
  useEffect(() => {
    return () => {
      flushEditorChanges();
    };
  }, [currentView, currentNoteId]);

  // --- FLOATING TEXT COLOR HIGHLIGHT DETECTOR ---
  const handleSelectionDetect = () => {
    const selection = window.getSelection();
    if (!selection) return;

    // Save range to execute the execCommand correctly
    if (selection.rangeCount > 0) {
      setSelectionRange(selection.getRangeAt(0));
    }
    
    const text = selection.toString().trim();
    if (text.length > 0) {
      try {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        setSelectionTextCached(text);
        
        // Position menu above selection
        setFloatingMenuCoord({
          top: rect.top + window.scrollY - 55,
          left: rect.left + window.scrollX + (rect.width / 2) - 130
        });
        setShowColorSelectionMenu(true);
      } catch (e) {
        // Range fail safe
      }
    } else {
      setShowColorSelectionMenu(false);
    }
  };

  // Close color callout menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target && (target.closest('#floating-color-menu') || target.closest('[id^="fine-"]') || target.id === 'fine-color-picker' || target.closest('input[type="color"]'))) {
        return;
      }
      // Small timeout to let selections complete safely
      setTimeout(() => {
        const selection = window.getSelection();
        if (!selection || selection.toString().trim().length === 0) {
          setShowColorSelectionMenu(false);
        }
      }, 80);
    };
    window.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('touchstart', handleOutsideClick, { passive: true });
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('touchstart', handleOutsideClick);
    };
  }, []);

  // Format Helper trigger
  const applyStyle = (command: string, arg: string = '') => {
    if (editorRef.current) {
      editorRef.current.focus();
    }
    
    // Restore selection range if needed
    if (selectionRange) {
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(selectionRange);
      }
    }
    
    document.execCommand(command, false, arg);
    handleEditorChange();
  };

  const handleApplyColor = (colorHex: string) => {
    setSelectionColor(colorHex);
    applyStyle('foreColor', colorHex);
    
    setRecentHighlightColors(prev => {
      const filtered = prev.filter(c => c.toLowerCase() !== colorHex.toLowerCase());
      const updated = [colorHex, ...filtered].slice(0, 5);
      localStorage.setItem('android_notes_recent_colors', JSON.stringify(updated));
      return updated;
    });
  };

  const handleApplyPrimaryColor = (colorHex: string) => {
    setSettings(prev => ({ ...prev, primaryColor: colorHex }));
    setRecentPrimaryColors(prev => {
      const filtered = prev.filter(c => c.toLowerCase() !== colorHex.toLowerCase());
      const updated = [colorHex, ...filtered].slice(0, 5);
      localStorage.setItem('android_notes_recent_primary_colors', JSON.stringify(updated));
      return updated;
    });
  };

  // Apply dynamic inline styling for H1, H2, TXT, Mono (mixed styles on same line)
  const applyInlineHeadingStyle = (styleType: 'H1' | 'H2' | 'TXT' | 'Mono') => {
    if (editorRef.current) {
      editorRef.current.focus();
    }
    
    // Restore selection range if needed
    if (selectionRange) {
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(selectionRange);
      }
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);

    let styleTagOpen = '';
    const styleTagClose = '</span>';
    
    if (styleType === 'H1') {
      styleTagOpen = `<span style="font-size: 1.625rem; font-weight: 800; color: #ffffff; line-height: 1.25; display: inline;">`;
    } else if (styleType === 'H2') {
      styleTagOpen = `<span style="font-size: 1.3rem; font-weight: 700; color: #f4f4f5; line-height: 1.3; display: inline;">`;
    } else if (styleType === 'TXT') {
      styleTagOpen = `<span style="font-size: 1rem; font-weight: normal; color: #e4e4e7; line-height: 1.6; display: inline;">`;
    } else if (styleType === 'Mono') {
      styleTagOpen = `<span style="font-family: ui-monospace, SFMono-Regular, monospace; background-color: rgba(255, 255, 255, 0.08); padding: 2px 6px; border-radius: 6px; font-size: 0.85rem; color: #34d399; display: inline;">`;
    }

    if (!range.collapsed) {
      // Selection active: wrap it!
      const selectedText = range.toString();
      const htmlToInsert = `${styleTagOpen}${selectedText}${styleTagClose}`;
      document.execCommand('insertHTML', false, htmlToInsert);
    } else {
      // Empty: insert a zero-width space inside the inline styled span to write forward!
      const spanId = `tok-${Date.now()}`;
      const htmlToInsert = `${styleTagOpen.replace('style="', `id="${spanId}" style="`)}&#x200B;</span>&nbsp;`;
      document.execCommand('insertHTML', false, htmlToInsert);

      // Place cursor inside the span at end of contents
      setTimeout(() => {
        const insertedSpan = editorRef.current?.querySelector(`#${spanId}`);
        if (insertedSpan) {
          const newRange = document.createRange();
          newRange.selectNodeContents(insertedSpan);
          newRange.collapse(false);
          selection.removeAllRanges();
          selection.addRange(newRange);
          setSelectionRange(newRange);
        }
      }, 30);
    }

    handleEditorChange();
  };

  // Compact Point-to-Point selection in a single button next to Mono
  const handlePointToPointSelection = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      alert(
        settings.language === 'it'
          ? 'Posiziona il cursore nel testo prima.'
          : 'Place cursor/caret in the text first.'
      );
      return;
    }
    const range = sel.getRangeAt(0);

    if (!startSelectionBoundary) {
      // Step A: save boundary point
      setStartSelectionBoundary({
         node: range.startContainer,
         offset: range.startOffset,
         textPreview: range.startContainer.textContent?.substring(Math.max(0, range.startOffset - 6), range.startOffset + 6) || '...'
      });
      setSelectionMessage(
        settings.language === 'it'
          ? 'Punto d\'inizio impostato! Posiziona il cursore a fine frase e riclicca il tasto 📍.'
          : 'Start point set! Move cursor to end position and click the 📍 button again.'
      );
    } else {
      // Step B: highlight everything between A and B!
      try {
        const startNode = startSelectionBoundary.node;
        const startOffset = startSelectionBoundary.offset;
        const endNode = range.startContainer;
        const endOffset = range.startOffset;

        const newRange = document.createRange();
        
        let isStartFirst = true;
        const cmp = startNode.compareDocumentPosition(endNode);
        if (startNode === endNode) {
          isStartFirst = startOffset <= endOffset;
        } else {
          isStartFirst = (cmp & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
        }

        if (isStartFirst) {
          newRange.setStart(startNode, startOffset);
          newRange.setEnd(endNode, endOffset);
        } else {
          newRange.setStart(endNode, endOffset);
          newRange.setEnd(startNode, startOffset);
        }

        sel.removeAllRanges();
        sel.addRange(newRange);
        setSelectionRange(newRange);
        
        setSelectionMessage(null); // Clear message once succeeded
      } catch (e) {
        console.error("Point selection failed:", e);
      }
      setStartSelectionBoundary(null); // Reset
    }
  };

  const handleInsertBulletSymbol = () => {
    // Add custom bullet point character inline
    applyStyle('insertHTML', '•&nbsp;');
  };

  const handleInsertLineDivider = () => {
    if (!editorRef.current) return;
    
    // Focus the editor to ensure we have a valid selection context
    editorRef.current.focus();
    
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    
    // Create a temporary hidden-nested span holding our cursor placeholder
    const span = document.createElement('span');
    span.textContent = '¯';
    span.style.display = 'inline-block';
    
    // Insert at current cursor position
    range.insertNode(span);
    
    // Measure editor dimensions and computed bounds
    const editorBox = editorRef.current;
    const editorRect = editorBox.getBoundingClientRect();
    const style = window.getComputedStyle(editorBox);
    const paddingRight = parseFloat(style.paddingRight || '20');
    const maxRight = editorRect.right - paddingRight - 10; // with a safe margin on the right edge
    
    let currentRect = span.getBoundingClientRect();
    const initialTop = currentRect.top;
    let safetyCount = 0;
    
    // Append macron symbols '¯' recursively as long as the span doesn't overflow to the next line 
    // or cross the right margin boundary computed physically from the rendering frame.
    while (currentRect.right < maxRight && safetyCount < 200) {
      span.textContent += '¯';
      currentRect = span.getBoundingClientRect();
      
      // If adding a macron caused the text to wrap to the next line, delete that last symbol and break
      if (currentRect.top > initialTop + 5) {
        span.textContent = span.textContent.slice(0, -1);
        break;
      }
      safetyCount++;
    }
    
    // Convert the measuring span back into a pure text node to allow native text editing (e.g. backspacing naturally)
    const textNode = document.createTextNode(span.textContent);
    span.parentNode?.replaceChild(textNode, span);
    
    // Position the typing cursor right after the newly inserted intelligent divider
    const newRange = document.createRange();
    newRange.setStartAfter(textNode);
    newRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(newRange);
    
    handleEditorChange();
  };

  // --- EDITOR VALUE CHANGED ---
  const handleEditorChangeSubmit = (noteId: string, html: string, textOnly: string) => {
    setNotes(prev => prev.map(note => {
      if (note.id === noteId) {
        const derivedTitle = textOnly.length > 50 
          ? textOnly.substring(0, 48) + '...' 
          : textOnly || t.unnamedNote;

        // Keep local storage up to date safely
        return {
          ...note,
          title: derivedTitle,
          content: html,
          updatedAt: Date.now()
        };
      }
      return note;
    }));
  };

  const flushEditorChanges = () => {
    if (currentNoteId && editorRef.current) {
      if (editorTimeoutRef.current) {
        clearTimeout(editorTimeoutRef.current);
        editorTimeoutRef.current = null;
      }
      const currentHTML = editorRef.current.innerHTML;
      const textOnly = editorRef.current.innerText.trim().split('\n')[0] || '';
      handleEditorChangeSubmit(currentNoteId, currentHTML, textOnly);
      
      // Force writing the updated notes list to local storage immediately on exit
      // to bypass the 1.5s typing debounce delay and ensure instant physical save
      setNotes(prev => {
        const derivedTitle = textOnly.length > 50 
          ? textOnly.substring(0, 48) + '...' 
          : textOnly || (settings.language === 'it' ? 'Nota senza nome' : 'Unnamed Note');

        const updated = prev.map(note => {
          if (note.id === currentNoteId) {
            return {
              ...note,
              title: derivedTitle,
              content: currentHTML,
              updatedAt: Date.now()
            };
          }
          return note;
        });
        try {
          localStorage.setItem('android_notes_notes', JSON.stringify(updated));
        } catch (e) {
          console.error("Storage save failed:", e);
        }
        return updated;
      });
    }
  };

  const handleEditorChange = () => {
    if (!currentNoteId || !editorRef.current) return;
    
    const currentHTML = editorRef.current.innerHTML;
    const textOnly = editorRef.current.innerText.trim().split('\n')[0] || '';

    if (editorTimeoutRef.current) {
      clearTimeout(editorTimeoutRef.current);
    }

    // Debounce state adjustments to allow 120 FPS high-performance native typing in browser
    editorTimeoutRef.current = setTimeout(() => {
      handleEditorChangeSubmit(currentNoteId, currentHTML, textOnly);
    }, 450);
  };

  // Delegated events for rich inline media widgets (consecutive 5 clicks to show controls, scale, move, delete)
  useEffect(() => {
    if (currentView !== 'editor' || !editorRef.current) return;

    const editor = editorRef.current;
    setIsWidgetEditing(false);

    const updateEditingState = () => {
      setTimeout(() => {
        const anyVisible = !!editor.querySelector('.media-controls:not(.hidden)');
        setIsWidgetEditing(anyVisible);
      }, 50);
    };

    // Continuous press-and-hold interval-based scaling support
    let activeResizeInterval: any = null;

    const stopResizeInterval = () => {
      if (activeResizeInterval) {
        clearInterval(activeResizeInterval);
        activeResizeInterval = null;
      }
    };

    const handleScalePressAndHold = (target: HTMLElement, e: Event): boolean => {
      const scaleDownBtn = target.closest('.media-widget-btn-scale-down');
      const scaleUpBtn = target.closest('.media-widget-btn-scale-up');
      if (!scaleDownBtn && !scaleUpBtn) return false;

      e.preventDefault();
      e.stopPropagation();

      const isUp = !!scaleUpBtn;
      const btn = scaleDownBtn || scaleUpBtn;
      if (!btn) return false;

      const widget = btn.closest('.media-widget') as HTMLElement;
      if (!widget) return false;

      const performResize = () => {
        const currentWidth = widget.style.width || '100%';
        let currentPct = 100;
        if (currentWidth.endsWith('%')) {
          currentPct = parseFloat(currentWidth) || 100;
        }
        let currentStep = Math.round(currentPct / 5);
        if (currentStep > 20) currentStep = 20;
        if (currentStep < 1) currentStep = 1;

        let newStep = isUp ? (currentStep + 1) : (currentStep - 1);
        if (newStep > 20) newStep = 20;
        if (newStep < 1) newStep = 1;

        widget.style.width = `${newStep * 5}%`;
        handleEditorChange();
      };

      // Perform once immediately
      performResize();

      // Clear previous just in case
      stopResizeInterval();

      // Start repeating interval after a slight initial delay for better control
      activeResizeInterval = setInterval(performResize, 100);

      // Listen on window to catch mouseup / touchend anywhere
      window.addEventListener('mouseup', stopResizeInterval, { once: true });
      window.addEventListener('touchend', stopResizeInterval, { once: true });
      window.addEventListener('touchcancel', stopResizeInterval, { once: true });

      return true;
    };

    const handleWidgetDragResize = (target: HTMLElement, e: MouseEvent | TouchEvent): boolean => {
      const handle = target.closest('.media-widget-resize-handle') as HTMLElement;
      if (!handle) return false;

      e.preventDefault();
      e.stopPropagation();

      const widget = handle.closest('.media-widget') as HTMLElement;
      if (!widget) return false;

      // Determine which handle was dragged
      const isBR = handle.classList.contains('handle-br');
      const isBL = handle.classList.contains('handle-bl');
      const isR = handle.classList.contains('handle-r');
      const isB = handle.classList.contains('handle-b');

      // Setup initial positions
      const startClientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const startClientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      const startWidth = widget.offsetWidth;
      const startHeight = widget.offsetHeight;

      // Temporarily remove standard transitions for perfectly fluid drag experience
      const originalTransition = widget.style.transition;
      widget.style.transition = 'none';

      const onDragMove = (moveEvent: MouseEvent | TouchEvent) => {
        const currentClientX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
        const currentClientY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;

        const dx = currentClientX - startClientX;
        const dy = currentClientY - startClientY;

        let newWidth = startWidth;
        let newHeight = startHeight;

        // Apply distinct offset arithmetic per handle type
        if (isBR) {
          newWidth = startWidth + dx;
          newHeight = startHeight + dy;
        } else if (isBL) {
          newWidth = startWidth - dx;
          newHeight = startHeight + dy;
        } else if (isR) {
          newWidth = startWidth + dx;
        } else if (isB) {
          newHeight = startHeight + dy;
        }

        // Limit range so they can shrink to a compact box ("posso renderla piccola come se fosse anche un quadratino")
        const minSize = 34; // Allow shrinking to a small visible square
        newWidth = Math.max(minSize, newWidth);
        newHeight = Math.max(minSize, newHeight);

        const isChart = widget.getAttribute('data-widget-type') === 'chart' || widget.getAttribute('data-chart-type') === 'table' || !!widget.querySelector('table');
        const isTable = widget.getAttribute('data-chart-type') === 'table' || !!widget.querySelector('table');

        // Apply styles to widget
        if (isBR || isBL || isR) {
          widget.style.width = `${newWidth}px`;
          widget.style.maxWidth = 'none'; // Uncap horizontal width max boundary
        }
        if (isBR || isBL || isB) {
          if (isTable) {
            widget.style.height = 'auto';
          } else {
            widget.style.height = isChart && !(isBR || isBL || isB) ? widget.style.height : `${newHeight}px`;
          }
        }

        if (isChart) {
          const body = widget.querySelector('.media-widget-body') as HTMLElement;
          if (body) {
            const baseW = 480;       // standard reference canvas width
            const baseH = 280;       // standard reference canvas height

            const availW = Math.max(30, newWidth - 24);
            let scale = availW / baseW;

            if (isR) {
              // Right handle: Compresses horizontally instead of zooming down or shrinking text size
              scale = 1;
              body.style.setProperty('zoom', '1');
              body.style.width = '100%';
              body.style.minWidth = '0';
              body.style.maxWidth = '100%';
            } else if (isB) {
              // Bottom handle: Scale vertically while keeping current zoom and horizontal fit config intact
              const currentZoom = parseFloat(body.style.getPropertyValue('zoom') || '1') || 1;
              scale = currentZoom;
              if (!body.style.width || body.style.width === '100%') {
                body.style.width = `${baseW}px`;
                body.style.minWidth = `${baseW}px`;
                body.style.maxWidth = `${baseW}px`;
              }
            } else {
              // Bottom-right / diagonal: full responsive zoom scale behavior as requested
              body.style.setProperty('zoom', scale.toString());
              body.style.width = `${baseW}px`;
              body.style.minWidth = `${baseW}px`;
              body.style.maxWidth = `${baseW}px`;
            }

            if (isTable) {
              body.style.height = 'auto';
              body.style.minHeight = 'auto';
              body.style.maxHeight = 'none';
              widget.style.height = 'auto';
            } else if (isBR || isBL || isB) {
              const availH = Math.max(16, newHeight - 72);
              const unscaledH = availH / scale;
              body.style.height = `${unscaledH}px`;
              body.style.minHeight = `${unscaledH}px`;
              body.style.maxHeight = `${unscaledH}px`;
            } else {
              const currentBodyH = body.style.height;
              if (!currentBodyH || currentBodyH === '100%') {
                body.style.height = `${baseH}px`;
                body.style.minHeight = `${baseH}px`;
                body.style.maxHeight = `${baseH}px`;
              }
            }
          }
        } else {
          // Handle non-chart widgets normal container adjustments
          const tableContainer = widget.querySelector('.overflow-x-auto') as HTMLElement;
          if (tableContainer) {
            tableContainer.style.height = '100%';
            tableContainer.style.maxHeight = '100%';
          }
        }
      };

      const onDragEnd = () => {
        window.removeEventListener('mousemove', onDragMove);
        window.removeEventListener('touchmove', onDragMove);
        window.removeEventListener('mouseup', onDragEnd);
        window.removeEventListener('touchend', onDragEnd);
        window.removeEventListener('touchcancel', onDragEnd);

        // Restore transitions
        widget.style.transition = originalTransition;

        // Force document state serialization
        handleEditorChange();
      };

      window.addEventListener('mousemove', onDragMove, { passive: false });
      window.addEventListener('touchmove', onDragMove, { passive: false });
      window.addEventListener('mouseup', onDragEnd, { once: true });
      window.addEventListener('touchend', onDragEnd, { once: true });
      window.addEventListener('touchcancel', onDragEnd, { once: true });

      return true;
    };

    const handleWidgetDragMove = (target: HTMLElement, e: MouseEvent | TouchEvent): boolean => {
      const dragHandle = target.closest('.media-widget-btn-drag-move');
      if (!dragHandle) return false;

      e.preventDefault();
      e.stopPropagation();

      const widget = dragHandle.closest('.media-widget') as HTMLElement;
      if (!widget) return false;

      const editor = widget.closest('#rich-text-editor-box') as HTMLElement;
      if (!editor) return false;

      // Add temporary styling during drag feedback
      widget.classList.add('opacity-40', 'border-dashed', 'border-amber-500');

      const onDragMove = (moveEvent: MouseEvent | TouchEvent) => {
        moveEvent.preventDefault();
        const currentY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;

        const children = Array.from(editor.children).filter(child => child !== widget && child.tagName !== 'SPAN');
        if (children.length === 0) return;

        let closestChild: Element | null = null;
        let closestDist = Infinity;
        let insertAfter = false;

        children.forEach(child => {
          const rect = child.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          const dist = Math.abs(currentY - midY);
          if (dist < closestDist) {
            closestDist = dist;
            closestChild = child;
            insertAfter = currentY > midY;
          }
        });

        if (closestChild) {
          if (insertAfter) {
            editor.insertBefore(widget, (closestChild as Element).nextElementSibling || null);
          } else {
            editor.insertBefore(widget, closestChild);
          }
        }
      };

      const onDragEnd = () => {
        window.removeEventListener('mousemove', onDragMove);
        window.removeEventListener('touchmove', onDragMove);
        window.removeEventListener('mouseup', onDragEnd);
        window.removeEventListener('touchend', onDragEnd);
        window.removeEventListener('touchcancel', onDragEnd);

        widget.classList.remove('opacity-40', 'border-dashed', 'border-amber-500');
        handleEditorChange();
      };

      window.addEventListener('mousemove', onDragMove, { passive: false });
      window.addEventListener('touchmove', onDragMove, { passive: false });
      window.addEventListener('mouseup', onDragEnd, { once: true });
      window.addEventListener('touchend', onDragEnd, { once: true });
      window.addEventListener('touchcancel', onDragEnd, { once: true });

      return true;
    };

    // Track sequential clicks on widgets for 5-click reveal trigger
    let clickedWidgetId: string | null = null;
    let clickCount = 0;
    let lastClickTime = 0;
    let clickTimeout: any = null;

    let longPressTimeout: any = null;
    let startX = 0;
    let startY = 0;

    const stopLongPressTimer = () => {
      if (longPressTimeout) {
        clearTimeout(longPressTimeout);
        longPressTimeout = null;
      }
    };

    const startLongPressTimer = (widget: HTMLElement, clientX: number, clientY: number) => {
      stopLongPressTimer();
      startX = clientX;
      startY = clientY;
      longPressTimeout = setTimeout(() => {
        const controls = widget.querySelector('.media-controls');
        if (controls && controls.classList.contains('hidden')) {
          editor.querySelectorAll('.media-controls').forEach(ctrl => {
            ctrl.classList.add('hidden');
          });
          controls.classList.remove('hidden');
          updateEditingState();
        }
      }, 500);
    };

    const handleLongPressMovement = (clientX: number, clientY: number) => {
      if (longPressTimeout) {
        const dx = Math.abs(clientX - startX);
        const dy = Math.abs(clientY - startY);
        if (dx > 10 || dy > 10) {
          stopLongPressTimer();
        }
      }
    };

    // Direct helper to coordinate active widget controls (confirm, scale down, scale up, move up/down, delete)
    const handleWidgetControl = (target: HTMLElement, e: Event): boolean => {
      // 1. Confirm button helper
      const confirmBtn = target.closest('.media-widget-btn-confirm');
      if (confirmBtn) {
        e.preventDefault();
        e.stopPropagation();
        const controls = confirmBtn.closest('.media-controls');
        if (controls) {
          controls.classList.add('hidden');
        }
        handleEditorChange();
        return true;
      }

      // 1_edit. Edit chart or table button
      const editChartBtn = target.closest('.media-widget-btn-edit-chart');
      if (editChartBtn) {
        e.preventDefault();
        e.stopPropagation();
        const widget = editChartBtn.closest('.media-widget') as HTMLElement;
        if (widget) {
          const widgetId = widget.getAttribute('data-widget-id');
          if (widgetId) {
            handleStartEditChartWidgetRef.current?.(widgetId, widget);
          }
        }
        return true;
      }

      // 1a. Table layout view toggle button (Excel vs responsive card block layout)
      const toggleLayoutBtn = target.closest('.media-widget-btn-toggle-layout');
      if (toggleLayoutBtn) {
        e.preventDefault();
        e.stopPropagation();
        const widget = toggleLayoutBtn.closest('.media-widget') as HTMLElement;
        if (widget) {
          const currentMode = widget.getAttribute('data-table-view') || 'grid';
          const newMode = currentMode === 'grid' ? 'card' : 'grid';
          widget.setAttribute('data-table-view', newMode);
          
          const labelEl = widget.querySelector('.table-layout-mode-label');
          if (labelEl) {
            labelEl.textContent = newMode === 'grid' ? 'Excel (Griglia)' : 'Accapo (Card)';
          }
          
          const gridCont = widget.querySelector('.excel-grid-container') as HTMLElement | null;
          const cardCont = widget.querySelector('.excel-card-container') as HTMLElement | null;
          if (gridCont && cardCont) {
            if (newMode === 'grid') {
              gridCont.classList.remove('hidden');
              cardCont.classList.add('hidden');
            } else {
              gridCont.classList.add('hidden');
              cardCont.classList.remove('hidden');
            }
          }
        }
        handleEditorChange();
        return true;
      }

      // 1b. Link preview toggle button
      const togglePreviewBtn = target.closest('.media-widget-btn-toggle-preview');
      if (togglePreviewBtn) {
        e.preventDefault();
        e.stopPropagation();
        const widget = togglePreviewBtn.closest('.media-widget') as HTMLElement;
        if (widget) {
          const isChartOrTable = widget.getAttribute('data-widget-type') === 'chart' || widget.getAttribute('data-chart-type') === 'table' || !!widget.querySelector('table');
          if (isChartOrTable) {
            handleOpenFullscreenWidget(widget);
            return true;
          }

          const isShowing = widget.getAttribute('data-show-preview') === 'true';
          const newShow = !isShowing;
          const url = widget.getAttribute('data-url') || '';
          const name = widget.getAttribute('data-name') || '';
          const id = widget.getAttribute('data-widget-id') || '';
          
          let domain = 'link';
          try {
            const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
            domain = parsed.hostname;
          } catch (err) {}
          
          widget.setAttribute('data-show-preview', String(newShow));
          widget.innerHTML = getLinkWidgetInnerHtml(url, name, newShow, id, domain);
        }
        handleEditorChange();
        return true;
      }

      // 1c. Follow Link trigger
      const linkGoBtn = target.closest('.media-widget-link-go');
      if (linkGoBtn) {
        e.preventDefault();
        e.stopPropagation();
        const url = linkGoBtn.getAttribute('data-href');
        if (url) {
          let cleanUrl = url;
          if (!/^https?:\/\//i.test(url)) {
            cleanUrl = 'https://' + url;
          }
          window.open(cleanUrl, '_blank');
        }
        return true;
      }

      // 2. Scale down button (allowing 1 to 20 steps, minimum 1, maximum 20, 1 step = 5% width)
      const scaleDownBtn = target.closest('.media-widget-btn-scale-down');
      if (scaleDownBtn) {
        e.preventDefault();
        e.stopPropagation();
        const widget = scaleDownBtn.closest('.media-widget') as HTMLElement;
        if (widget) {
          const currentWidth = widget.style.width || '100%';
          let currentPct = 100;
          if (currentWidth.endsWith('%')) {
            currentPct = parseFloat(currentWidth) || 100;
          }
          let currentStep = Math.round(currentPct / 5);
          if (currentStep > 20) currentStep = 20;
          if (currentStep < 1) currentStep = 1;

          let newStep = currentStep - 1;
          if (newStep < 1) newStep = 1;

          widget.style.width = `${newStep * 5}%`;
        }
        handleEditorChange();
        return true;
      }

      // 3. Scale up button (allowing 1 to 20 steps, minimum 1, maximum 20, 1 step = 5% width)
      const scaleUpBtn = target.closest('.media-widget-btn-scale-up');
      if (scaleUpBtn) {
        e.preventDefault();
        e.stopPropagation();
        const widget = scaleUpBtn.closest('.media-widget') as HTMLElement;
        if (widget) {
          const currentWidth = widget.style.width || '100%';
          let currentPct = 100;
          if (currentWidth.endsWith('%')) {
            currentPct = parseFloat(currentWidth) || 100;
          }
          let currentStep = Math.round(currentPct / 5);
          if (currentStep > 20) currentStep = 20;
          if (currentStep < 1) currentStep = 1;

          let newStep = currentStep + 1;
          if (newStep > 20) newStep = 20;

          widget.style.width = `${newStep * 5}%`;
        }
        handleEditorChange();
        return true;
      }

      // Float Left Wrap text
      const wrapLeftBtn = target.closest('.media-widget-btn-wrap-left');
      if (wrapLeftBtn) {
        e.preventDefault();
        e.stopPropagation();
        const widget = wrapLeftBtn.closest('.media-widget') as HTMLElement;
        if (widget) {
          widget.style.float = 'left';
          widget.style.display = 'inline-block';
          widget.style.marginRight = '16px';
          widget.style.marginBottom = '12px';
          widget.style.marginLeft = '0';
          widget.style.marginTop = '4px';
        }
        handleEditorChange();
        return true;
      }

      // Float None Wrap / clear
      const wrapNoneBtn = target.closest('.media-widget-btn-wrap-none');
      if (wrapNoneBtn) {
        e.preventDefault();
        e.stopPropagation();
        const widget = wrapNoneBtn.closest('.media-widget') as HTMLElement;
        if (widget) {
          widget.style.float = 'none';
          widget.style.display = 'inline-block';
          widget.style.marginRight = '0';
          widget.style.marginBottom = '8px';
          widget.style.marginLeft = '0';
          widget.style.marginTop = '8px';
        }
        handleEditorChange();
        return true;
      }

      // Float Right Wrap text
      const wrapRightBtn = target.closest('.media-widget-btn-wrap-right');
      if (wrapRightBtn) {
        e.preventDefault();
        e.stopPropagation();
        const widget = wrapRightBtn.closest('.media-widget') as HTMLElement;
        if (widget) {
          widget.style.float = 'right';
          widget.style.display = 'inline-block';
          widget.style.marginLeft = '16px';
          widget.style.marginBottom = '12px';
          widget.style.marginRight = '0';
          widget.style.marginTop = '4px';
        }
        handleEditorChange();
        return true;
      }

      // 4. Move up button
      const moveUpBtn = target.closest('.media-widget-btn-move-up');
      if (moveUpBtn) {
        e.preventDefault();
        e.stopPropagation();
        const widget = moveUpBtn.closest('.media-widget') as HTMLElement;
        if (widget && widget.previousElementSibling) {
          widget.parentNode?.insertBefore(widget, widget.previousElementSibling);
        }
        handleEditorChange();
        return true;
      }

      // 5. Move down button
      const moveDownBtn = target.closest('.media-widget-btn-move-down');
      if (moveDownBtn) {
        e.preventDefault();
        e.stopPropagation();
        const widget = moveDownBtn.closest('.media-widget') as HTMLElement;
        if (widget && widget.nextElementSibling) {
          widget.parentNode?.insertBefore(widget, widget.nextElementSibling.nextElementSibling || null);
        }
        handleEditorChange();
        return true;
      }

      // 6. Delete button (Direct remove, ensuring seamless sandboxed/webview compatibility)
      const deleteBtn = target.closest('.media-widget-btn-delete');
      if (deleteBtn) {
        e.preventDefault();
        e.stopPropagation();
        const widget = deleteBtn.closest('.media-widget');
        if (widget) {
          widget.remove();
        }
        handleEditorChange();
        return true;
      }

      return false;
    };

    const handleEditorInteraction = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Ensure any direct controls are immediately intercepted and executed
      if (handleWidgetControl(target, e)) {
        updateEditingState();
        return;
      }

      // 7. Click on media widget but NOT on controls -> Handle consecutive click count to show controls
      const widget = target.closest('.media-widget') as HTMLElement;
      if (widget) {
        // Skip if clicking inside the controls themselves
        if (target.closest('.media-controls')) return;

        // Prevent browser's selection highlight/focus outline that selects the image
        e.preventDefault();
        e.stopPropagation();

        const widgetId = widget.getAttribute('data-widget-id') || 'gen';
        const now = Date.now();

        // Clear any pending single-click fullscreen timers when a new click register comes
        if (clickTimeout) {
          clearTimeout(clickTimeout);
          clickTimeout = null;
        }

        // Increment count if consecutively clicked on the same widget within 400ms between clicks
        if (clickedWidgetId === widgetId && (now - lastClickTime < 400)) {
          clickCount++;
        } else {
          clickedWidgetId = widgetId;
          clickCount = 1;
        }
        lastClickTime = now;

        if (clickCount >= 5) {
          // Hide any other shown controls in the editor to stay clean
          editor.querySelectorAll('.media-controls').forEach(ctrl => {
            ctrl.classList.add('hidden');
          });

          const controls = widget.querySelector('.media-controls');
          if (controls) {
            controls.classList.remove('hidden');
          }
          clickCount = 0; // reset
        } else {
          // Single tap zoom behavior: If they clicked on an image inside the image or drawing widget, zoom into it!
          const img = target.closest('img') as HTMLImageElement | null;
          const controls = widget.querySelector('.media-controls');
          const isEditing = controls && !controls.classList.contains('hidden');

          const isChartOrTable = widget.getAttribute('data-widget-type') === 'chart' || widget.getAttribute('data-chart-type') === 'table' || widget.querySelector('table');
          if (!isEditing && isChartOrTable && !target.closest('button')) {
            clickTimeout = setTimeout(() => {
              if (clickCount === 1) {
                handleOpenFullscreenWidget(widget);
              }
              clickCount = 0;
            }, 280);
          } else if (!isEditing && img && (widget.getAttribute('data-widget-type') === 'image' || widget.getAttribute('data-widget-type') === 'drawing')) {
            const srcUrl = img.src;
            // Introduce a short delay (280ms) before opening fullscreen modal. 
            // If they click again quickly (such as in a continuous edit/resize series), the timer gets aborted.
            clickTimeout = setTimeout(() => {
              if (clickCount === 1) {
                setFullscreenMediaUrl(srcUrl);
                setFullscreenMediaType('image');
              }
              clickCount = 0; // reset
            }, 280);
          }
        }
      } else {
        // Clicked outside any widget inside the active editor: hide all active inline controls to keep editing focused
        editor.querySelectorAll('.media-controls').forEach(ctrl => {
          ctrl.classList.add('hidden');
        });
        clickCount = 0;
        clickedWidgetId = null;
        if (clickTimeout) {
          clearTimeout(clickTimeout);
          clickTimeout = null;
        }
      }

      updateEditingState();
    };

    const handleEditorMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Handle interactive drag-to-reposition first
      if (handleWidgetDragMove(target, e)) {
        updateEditingState();
        return;
      }

      // Handle interactive drag-to-resize handles first
      if (handleWidgetDragResize(target, e)) {
        updateEditingState();
        return;
      }

      // Handle continuous scaling first
      if (handleScalePressAndHold(target, e)) {
        updateEditingState();
        return;
      }

      // Handle direct widget controls immediately on mouse down for native responsiveness and instant deletion
      if (handleWidgetControl(target, e)) {
        updateEditingState();
        return;
      }

      const widget = target.closest('.media-widget') as HTMLElement;
      if (widget && !target.closest('.media-controls')) {
        startLongPressTimer(widget, e.clientX, e.clientY);
        e.preventDefault();
        e.stopPropagation();
      }

      updateEditingState();
    };

    const handleEditorTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement;

      // Handle interactive drag-to-reposition first
      if (handleWidgetDragMove(target, e)) {
        updateEditingState();
        return;
      }

      // Handle interactive drag-to-resize handles first
      if (handleWidgetDragResize(target, e)) {
        updateEditingState();
        return;
      }

      if (handleScalePressAndHold(target, e)) {
        updateEditingState();
        return;
      }

      const widget = target.closest('.media-widget') as HTMLElement;
      const touch = e.touches[0];
      if (widget && touch && !target.closest('.media-controls')) {
        startLongPressTimer(widget, touch.clientX, touch.clientY);
      }
    };

    const handleWindowMouseMove = (e: MouseEvent) => {
      handleLongPressMovement(e.clientX, e.clientY);
    };

    const handleWindowTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) {
        handleLongPressMovement(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const handleWindowMouseUp = () => {
      stopLongPressTimer();
    };

    const handleWindowTouchEnd = () => {
      stopLongPressTimer();
    };

    editor.addEventListener('mousedown', handleEditorMouseDown);
    editor.addEventListener('touchstart', handleEditorTouchStart, { passive: false });
    editor.addEventListener('click', handleEditorInteraction);

    window.addEventListener('mousemove', handleWindowMouseMove, { passive: true });
    window.addEventListener('touchmove', handleWindowTouchMove, { passive: true });
    window.addEventListener('mouseup', handleWindowMouseUp, { passive: true });
    window.addEventListener('touchend', handleWindowTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleWindowTouchEnd, { passive: true });

    return () => {
      editor.removeEventListener('mousedown', handleEditorMouseDown);
      editor.removeEventListener('touchstart', handleEditorTouchStart);
      editor.removeEventListener('click', handleEditorInteraction);
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('touchmove', handleWindowTouchMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
      window.removeEventListener('touchend', handleWindowTouchEnd);
      window.removeEventListener('touchcancel', handleWindowTouchEnd);
      stopResizeInterval();
      stopLongPressTimer();
      if (clickTimeout) {
        clearTimeout(clickTimeout);
      }
      setIsWidgetEditing(false);
    };
  }, [currentView, currentNoteId, settings.language]);

  // Trigger checkbox interaction logic in note preview/editor mode
  const handleEditorClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'checkbox') {
      const isChecked = (target as HTMLInputElement).checked;
      if (isChecked) {
        target.setAttribute('checked', 'true');
        const nextSpan = target.nextElementSibling;
        if (nextSpan) {
          nextSpan.classList.add('line-through', 'text-gray-400', 'dark:text-zinc-500');
        }
      } else {
        target.removeAttribute('checked');
        const nextSpan = target.nextElementSibling;
        if (nextSpan) {
          nextSpan.classList.remove('line-through', 'text-gray-400', 'dark:text-zinc-500');
        }
      }
      handleEditorChange();
    }
  };

  // --- LONG PRESS NOTE HANDLERS ---
  const handleStartPress = (e: React.MouseEvent | React.TouchEvent, note: Note) => {
    isLongPressActiveRef.current = false;
    
    // Start timeout for long press detection
    longPressTimerRef.current = setTimeout(() => {
      isLongPressActiveRef.current = true;
      setContextMenuNote(note);
      
      // Attempt haptic feedback
      if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
        try {
          window.navigator.vibrate(50);
        } catch (err) {}
      }
    }, 550);
  };

  const handleEndPress = (e: React.MouseEvent | React.TouchEvent, note: Note) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleCancelPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleNoteClick = (note: Note, e: React.MouseEvent) => {
    if (isLongPressActiveRef.current) {
      isLongPressActiveRef.current = false;
      return;
    }
    triggerNoteSelectionWithLockCheck(note);
  };

  const handleSaveRenamePreview = () => {
    if (!renamePreviewNoteId) return;
    setNotes(prev => prev.map(n => {
      if (n.id === renamePreviewNoteId) {
        return {
          ...n,
          title: newNoteTitle,
          customPreview: newNoteCustomPreview,
          updatedAt: Date.now()
        };
      }
      return n;
    }));
    setIsRenamePreviewModalOpen(false);
    setRenamePreviewNoteId(null);
  };

  // --- ACTIONS ---
  
  // Folder Creation and management
  const handleAddNewFolder = () => {
    if (!folderNameInput.trim()) return;

    if (editingFolderId) {
      // Rename & Update parent and description
      setFolders(prev => prev.map(f => f.id === editingFolderId ? { 
        ...f, 
        name: folderNameInput, 
        parentId: folderParentIdInput || undefined,
        description: folderDescriptionInput.trim() || undefined
      } : f));
      setEditingFolderId(null);
    } else {
      // Create new
      const fId = 'f-' + Date.now();
      const newF: Folder = {
        id: fId,
        name: folderNameInput,
        pinned: false,
        parentId: folderParentIdInput || undefined,
        description: folderDescriptionInput.trim() || undefined,
        showDescription: true
      };
      setFolders(prev => [...prev, newF]);
    }

    setFolderNameInput('');
    setFolderParentIdInput('');
    setFolderDescriptionInput('');
    setIsNewFolderModalOpen(false);
  };

  const handleDeleteFolder = (folderId: string, event?: React.MouseEvent | React.TouchEvent) => {
    if (event) event.stopPropagation();
    const folder = folders.find(f => f.id === folderId);
    if (folder?.isSystem) {
      alert(t.cantDeleteAll);
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: settings.language === 'it' ? 'Elimina Cartella' : 'Delete Folder',
      description: t.deleteFolderPrompt,
      confirmText: settings.language === 'it' ? 'Elimina' : 'Delete',
      cancelText: settings.language === 'it' ? 'Annulla' : 'Cancel',
      isDestructive: true,
      onConfirm: () => {
        // Remove target folder and any nested subfolders
        const getFolderAndSubfolderIds = (id: string): string[] => {
          const children = folders.filter(f => f.parentId === id);
          let ids = [id];
          children.forEach(c => {
            ids = [...ids, ...getFolderAndSubfolderIds(c.id)];
          });
          return ids;
        };

        const idsToRemove = getFolderAndSubfolderIds(folderId);

        setFolders(prev => prev.filter(f => !idsToRemove.includes(f.id)));
        // Delete notes inside folder and subfolders
        setNotes(prev => prev.filter(n => !n.folderId || !idsToRemove.includes(n.folderId)));
        
        if (selectedFolderId && idsToRemove.includes(selectedFolderId)) {
          setSelectedFolderId(null);
          setCurrentView('folders');
        }
        setConfirmDialog(null);
      }
    });
  };

  const handleToggleFolderPin = (folderId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setFolders(prev => prev.map(f => f.id === folderId ? { ...f, pinned: !f.pinned } : f));
  };

  // --- LONG PRESS FOLDER HANDLERS & ACTIONS ---
  const handleStartFolderPress = (e: React.MouseEvent | React.TouchEvent, folder: Folder) => {
    // Skip system/fixed folders (e.g. Tutte le note f-all) from modification context if needed
    if (folder.id === 'f-all' || folder.isSystem) return;
    
    isFolderLongPressActiveRef.current = false;
    
    // Start timeout for long press detection
    folderLongPressTimerRef.current = setTimeout(() => {
      isFolderLongPressActiveRef.current = true;
      setContextMenuFolder(folder);
      setFolderDescriptionInput(folder.description || '');
      setFolderShowDescriptionInput(folder.showDescription ?? true);
      
      // Attempt haptic feedback
      if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
        try {
          window.navigator.vibrate(50);
        } catch (err) {}
      }
    }, 550);
  };

  const handleEndFolderPress = (e: React.MouseEvent | React.TouchEvent, folder: Folder) => {
    if (folderLongPressTimerRef.current) {
      clearTimeout(folderLongPressTimerRef.current);
      folderLongPressTimerRef.current = null;
    }
  };

  const handleCancelFolderPress = () => {
    if (folderLongPressTimerRef.current) {
      clearTimeout(folderLongPressTimerRef.current);
      folderLongPressTimerRef.current = null;
    }
  };

  const handleFolderClick = (folder: Folder, e: React.MouseEvent) => {
    if (isFolderLongPressActiveRef.current) {
      isFolderLongPressActiveRef.current = false;
      return;
    }
    setSelectedFolderId(folder.id);
    setCurrentView('notes-list');
  };

  const handleSaveFolderDescription = () => {
    if (!contextMenuFolder) return;
    setFolders(prev => prev.map(f => f.id === contextMenuFolder.id ? { 
      ...f, 
      description: folderDescriptionInput, 
      showDescription: folderShowDescriptionInput 
    } : f));
    setContextMenuFolder(null);
  };

  const handleDeleteAllNotesInFolder = () => {
    if (!contextMenuFolder) return;
    const confirmDel = window.confirm(
      settings.language === 'it' 
        ? `Sei sicuro di voler eliminare tutte le note contenute nella cartella "${contextMenuFolder.name}"?` 
        : `Are you sure you want to delete all notes in folder "${contextMenuFolder.name}"?`
    );
    if (confirmDel) {
      setNotes(prev => prev.filter(n => n.folderId !== contextMenuFolder.id));
      setContextMenuFolder(null);
    }
  };

  const handleDeleteAllSubfolders = () => {
    if (!contextMenuFolder) return;
    const confirmDel = window.confirm(
      settings.language === 'it' 
        ? `Sei sicuro di voler eliminare TUTTE le sottocartelle della cartella "${contextMenuFolder.name}" e tutte le loro note?` 
        : `Are you sure you want to delete ALL subfolders of folder "${contextMenuFolder.name}" and all their notes?`
    );
    if (confirmDel) {
      const getSubfolderIds = (id: string): string[] => {
        const list = folders.filter(f => f.parentId === id);
        let ids = list.map(f => f.id);
        list.forEach(f => {
          ids = [...ids, ...getSubfolderIds(f.id)];
        });
        return ids;
      };
      const subIds = getSubfolderIds(contextMenuFolder.id);
      
      setFolders(prev => prev.filter(f => !subIds.includes(f.id)));
      setNotes(prev => prev.filter(n => !subIds.includes(n.folderId)));
      setContextMenuFolder(null);
    }
  };

  // Note actions
  const handleCreateNote = () => {
    // Determine target folderId
    let targetFolderId = 'f-notes'; // default note folder
    if (selectedFolderId && selectedFolderId !== 'f-all') {
      targetFolderId = selectedFolderId;
    }

    const newNoteId = 'note-' + Date.now();
    const newNote: Note = {
      id: newNoteId,
      folderId: targetFolderId,
      title: t.unnamedNote,
      content: '<div></div>',
      pinned: false,
      passwordLocked: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      attachments: []
    };

    setNotes(prev => [newNote, ...prev]);
    setCurrentNoteId(newNoteId);
    setCurrentView('editor');
  };

  const handleDuplicateNote = (note: Note, event?: React.MouseEvent) => {
    if (event) event.stopPropagation();
    
    // Password lock check
    if (note.passwordLocked && !unlockedSessionKeys[note.id]) {
      alert(t.locked);
      return;
    }

    const copyNote: Note = {
      ...note,
      id: 'note-' + Date.now(),
      title: note.title + ' (Copy)',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      pinned: false
    };

    setNotes(prev => [copyNote, ...prev]);
  };

  const handleToggleNotePin = (noteId: string, event?: React.MouseEvent) => {
    if (event) event.stopPropagation();
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, pinned: !n.pinned } : n));
  };

  const handleToggleNoteLinedPaper = (noteId: string, event?: React.MouseEvent) => {
    if (event) event.stopPropagation();
    setNotes(prev => prev.map(n => {
      if (n.id === noteId) {
        const currentVal = n.linedPaper !== undefined ? n.linedPaper : !!settings.linedPaper;
        return { ...n, linedPaper: !currentVal };
      }
      return n;
    }));
  };

  const handleDeleteNote = (noteId: string, event?: React.MouseEvent) => {
    if (event) event.stopPropagation();
    
    setConfirmDialog({
      isOpen: true,
      title: settings.language === 'it' ? 'Elimina Nota' : 'Delete Note',
      description: settings.language === 'it' ? 'Vuoi davvero eliminare questa nota?' : 'Are you sure you want to delete this note?',
      confirmText: settings.language === 'it' ? 'Elimina' : 'Delete',
      cancelText: settings.language === 'it' ? 'Annulla' : 'Cancel',
      isDestructive: true,
      onConfirm: () => {
        setNotes(prev => prev.filter(n => n.id !== noteId));
        if (currentNoteId === noteId) {
          setCurrentNoteId(null);
          setCurrentView('notes-list');
        }
        setConfirmDialog(null);
      }
    });
  };

  const handleMoveNoteClick = (noteId: string, event?: React.MouseEvent) => {
    if (event) event.stopPropagation();
    setMovingNoteId(noteId);
    setMoveNoteFolderModalOpen(true);
  };

  const handleExecuteMoveNote = (folderId: string) => {
    if (!movingNoteId) return;
    setNotes(prev => prev.map(n => n.id === movingNoteId ? { ...n, folderId } : n));
    setMovingNoteId(null);
    setMoveNoteFolderModalOpen(false);
  };

  // HTML templates for inline media widgets
  const getHtmlForImage = (url: string, name: string, size: string, id: string) => `
  <div class="media-widget relative p-2 my-2 bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-full select-none pb-3" contenteditable="false" style="width: 100%; min-width: 25px; transition: width 0.15s ease-out; vertical-align: middle; display: block; clear: both; margin: 8px auto;" data-widget-id="${id}" data-widget-type="image">
    <div class="media-controls flex flex-nowrap items-center justify-center bg-neutral-950 border border-neutral-800 rounded-xl p-1 gap-1 mb-2 shadow-lg text-neutral-300 w-full select-none" style="min-width: max-content;">
      <button type="button" class="media-widget-btn-scale-down p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center" title="Rimpicciolisci"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="rotate-180"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg></button>
      <button type="button" class="media-widget-btn-scale-up p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center" title="Ingrandisci"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg></button>
      
      <!-- Wrap Left, Clear/None, Wrap Right controls -->
      <button type="button" class="media-widget-btn-wrap-left p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center" title="Testo scorre a destra">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="12" x2="10" y2="12"></line><line x1="21" y1="18" x2="10" y2="18"></line><rect x="3" y="10" width="5" height="10" rx="1"></rect></svg>
      </button>
      <button type="button" class="media-widget-btn-wrap-none p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center" title="Nessun allineamento">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="12" x2="3" y2="12"></line><line x1="21" y1="18" x2="3" y2="18"></line></svg>
      </button>
      <button type="button" class="media-widget-btn-wrap-right p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center" title="Testo scorre a sinistra">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" y1="6" x2="3" y2="6"></line><line x1="14" y1="12" x2="3" y2="12"></line><line x1="14" y1="18" x2="3" y2="18"></line><rect x="16" y="10" width="5" height="10" rx="1"></rect></svg>
      </button>
 
      <button type="button" class="media-widget-btn-move-up p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center" title="Sposta Su"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg></button>
      <button type="button" class="media-widget-btn-move-down p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center" title="Sposta Giù"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg></button>
      <button type="button" class="media-widget-btn-delete p-1.5 rounded hover:bg-neutral-800 text-red-500 hover:text-red-400 flex items-center justify-center" title="Elimina"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
      <button type="button" class="media-widget-btn-confirm ml-1 px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-[9px] uppercase tracking-wider transition-colors duration-100 shrink-0" title="Conferma">Conferma</button>
    </div>
    <div class="relative overflow-hidden rounded-xl select-none">
      <img src="${url}" class="max-h-64 md:max-h-80 w-full object-cover rounded-xl select-none" draggable="false" />
    </div>
  </div>
  <span>&nbsp;</span>
  `;
 
  const getHtmlForVideo = (url: string, name: string, size: string, id: string) => `
  <div class="media-widget relative p-2 my-2 bg-neutral-900 border border-neutral-855 rounded-2xl w-full max-w-full select-none pb-3" contenteditable="false" style="width: 100%; min-width: 25px; transition: width 0.15s ease-out; vertical-align: middle; display: block; clear: both; margin: 8px auto;" data-widget-id="${id}" data-widget-type="video">
    <div class="media-controls flex flex-nowrap items-center justify-center bg-neutral-950 border border-neutral-800 rounded-xl p-1 gap-1 mb-2 shadow-lg text-neutral-300 w-full select-none" style="min-width: max-content;">
      <button type="button" class="media-widget-btn-scale-down p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center" title="Rimpicciolisci"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="rotate-180"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg></button>
      <button type="button" class="media-widget-btn-scale-up p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center" title="Ingrandisci"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg></button>
      
      <!-- Wrap Left, Clear/None, Wrap Right controls -->
      <button type="button" class="media-widget-btn-wrap-left p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center" title="Testo scorre a destra">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="12" x2="10" y2="12"></line><line x1="21" y1="18" x2="10" y2="18"></line><rect x="3" y="10" width="5" height="10" rx="1"></rect></svg>
      </button>
      <button type="button" class="media-widget-btn-wrap-none p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center" title="Nessun allineamento">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="12" x2="3" y2="12"></line><line x1="21" y1="18" x2="3" y2="18"></line></svg>
      </button>
      <button type="button" class="media-widget-btn-wrap-right p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center" title="Testo scorre a sinistra">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" y1="6" x2="3" y2="6"></line><line x1="14" y1="12" x2="3" y2="12"></line><line x1="14" y1="18" x2="3" y2="18"></line><rect x="16" y="10" width="5" height="10" rx="1"></rect></svg>
      </button>
 
      <button type="button" class="media-widget-btn-move-up p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center" title="Sposta Su"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg></button>
      <button type="button" class="media-widget-btn-move-down p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center" title="Sposta Giù"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg></button>
      <button type="button" class="media-widget-btn-delete p-1.5 rounded hover:bg-neutral-800 text-red-500 hover:text-red-400 flex items-center justify-center" title="Elimina"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
      <button type="button" class="media-widget-btn-confirm ml-1 px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-[9px] uppercase tracking-wider transition-colors duration-100 shrink-0" title="Conferma">Conferma</button>
    </div>
    <div class="relative rounded-xl overflow-hidden bg-black flex items-center justify-center border border-zinc-800 select-none">
      <video src="${url}" class="w-full max-h-[300px] object-contain select-none" controls></video>
    </div>
  </div>
  <span>&nbsp;</span>
  `;
 
  const getHtmlForAudio = (url: string, name: string, size: string, id: string) => `
  <div class="media-widget relative p-3 my-2 bg-neutral-900 border border-neutral-855 rounded-2xl w-full max-w-md select-none" contenteditable="false" style="width: 100%; min-width: 25px; transition: width 0.15s ease-out; vertical-align: middle; display: block; clear: both; margin: 8px auto;" data-widget-id="${id}" data-widget-type="audio">
    <div class="media-controls flex flex-nowrap items-center justify-center bg-neutral-950 border border-neutral-800 rounded-xl p-1 gap-1 mb-2 shadow-lg text-neutral-300 w-full select-none" style="min-width: max-content;">
      <button type="button" class="media-widget-btn-scale-down p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center" title="Rimpicciolisci"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="rotate-180"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg></button>
      <button type="button" class="media-widget-btn-scale-up p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center" title="Ingrandisci"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg></button>
      
      <!-- Wrap Left, Clear/None, Wrap Right controls -->
      <button type="button" class="media-widget-btn-wrap-left p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center" title="Testo scorre a destra">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="12" x2="10" y2="12"></line><line x1="21" y1="18" x2="10" y2="18"></line><rect x="3" y="10" width="5" height="10" rx="1"></rect></svg>
      </button>
      <button type="button" class="media-widget-btn-wrap-none p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center" title="Nessun allineamento">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="12" x2="3" y2="12"></line><line x1="21" y1="18" x2="3" y2="18"></line></svg>
      </button>
      <button type="button" class="media-widget-btn-wrap-right p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center" title="Testo scorre a sinistra">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" y1="6" x2="3" y2="6"></line><line x1="14" y1="12" x2="3" y2="12"></line><line x1="14" y1="18" x2="3" y2="18"></line><rect x="16" y="10" width="5" height="10" rx="1"></rect></svg>
      </button>
 
      <button type="button" class="media-widget-btn-move-up p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center" title="Sposta Su"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg></button>
      <button type="button" class="media-widget-btn-move-down p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center" title="Sposta Giù"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg></button>
      <button type="button" class="media-widget-btn-delete p-1.5 rounded hover:bg-neutral-800 text-red-500 hover:text-red-400 flex items-center justify-center" title="Elimina"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
      <button type="button" class="media-widget-btn-confirm ml-1 px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-[9px] uppercase tracking-wider transition-colors duration-100 shrink-0" title="Conferma">Conferma</button>
    </div>
    <div class="py-1 select-none">
      <div class="flex items-center gap-2 mb-2 select-none">
        <div class="w-7 h-7 rounded-full bg-yellow-500/10 flex items-center justify-center text-[#E5A93C] select-none">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
        </div>
        <span class="text-xs font-semibold text-neutral-300">Audio</span>
      </div>
      <audio src="${url}" controls class="w-full h-8 accent-yellow-500 mt-1 select-none"></audio>
    </div>
  </div>
  <span>&nbsp;</span>
  `;
 
  const getHtmlForDrawing = (url: string, id: string) => `
  <div class="media-widget relative p-2 my-2 bg-white rounded-2xl w-full max-w-full select-none border border-neutral-300" contenteditable="false" style="width: 100%; min-width: 25px; transition: width 0.15s ease-out; vertical-align: middle; display: block; clear: both; margin: 8px auto;" data-widget-id="${id}" data-widget-type="drawing">
    <div class="media-controls flex flex-nowrap items-center justify-center bg-neutral-950 border border-neutral-800 rounded-xl p-1 gap-1 mb-2 shadow-lg text-neutral-300 w-full select-none" style="min-width: max-content;">
      <button type="button" class="media-widget-btn-scale-down p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center" title="Rimpicciolisci"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="rotate-180"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg></button>
      <button type="button" class="media-widget-btn-scale-up p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center" title="Ingrandisci"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg></button>
      
      <!-- Wrap Left, Clear/None, Wrap Right controls -->
      <button type="button" class="media-widget-btn-wrap-left p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center" title="Testo scorre a destra">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="12" x2="10" y2="12"></line><line x1="21" y1="18" x2="10" y2="18"></line><rect x="3" y="10" width="5" height="10" rx="1"></rect></svg>
      </button>
      <button type="button" class="media-widget-btn-wrap-none p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center" title="Nessun allineamento">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="12" x2="3" y2="12"></line><line x1="21" y1="18" x2="3" y2="18"></line></svg>
      </button>
      <button type="button" class="media-widget-btn-wrap-right p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center" title="Testo scorre a sinistra">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" y1="6" x2="3" y2="6"></line><line x1="14" y1="12" x2="3" y2="12"></line><line x1="14" y1="18" x2="3" y2="18"></line><rect x="16" y="10" width="5" height="10" rx="1"></rect></svg>
      </button>
 
      <button type="button" class="media-widget-btn-move-up p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center" title="Sposta Su"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg></button>
      <button type="button" class="media-widget-btn-move-down p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center" title="Sposta Giù"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg></button>
      <button type="button" class="media-widget-btn-delete p-1.5 rounded hover:bg-neutral-800 text-red-500 hover:text-red-400 flex items-center justify-center" title="Elimina"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
      <button type="button" class="media-widget-btn-confirm ml-1 px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-[9px] uppercase tracking-wider transition-colors duration-100 shrink-0" title="Conferma">Conferma</button>
    </div>
    <div class="relative bg-white rounded-xl p-1.5 overflow-hidden flex items-center justify-center w-full min-h-[150px] select-none">
      <img src="${url}" class="max-h-64 object-contain select-none" draggable="false" />
    </div>
  </div>
  <span>&nbsp;</span>
  `;

  const getHtmlForChart = (
    name: string, 
    chartType: 'bar' | 'line' | 'pie' | 'table', 
    chartData: any[], 
    primaryColor: string, 
    id: string,
    tableData?: string[][],
    tableStyleSource?: {
      rowColors?: { [rowIdx: number]: string };
      colColors?: { [colIdx: number]: string };
      cellColors?: { [cellKey: string]: string };
      textColors?: { [cellKey: string]: string };
      rowTextColors?: { [rowIdx: number]: string };
      colTextColors?: { [colIdx: number]: string };
    }
  ) => {
    let innerChartHtml = '';

    if (chartType === 'bar') {
      innerChartHtml = `<div class="space-y-2 py-1">` + chartData.map(item => {
        const pct = Math.max(5, Math.min(100, item.value));
        const color = item.color || primaryColor || '#E5A93C';
        return `
          <div class="space-y-1">
            <div class="flex justify-between text-[11px] text-neutral-400">
              <span class="font-medium truncate max-w-[120px] select-none">${item.label}</span>
              <span class="font-mono font-bold text-neutral-200 select-none">${item.value}</span>
            </div>
            <div class="w-full bg-neutral-800 rounded-full h-2 overflow-hidden">
              <div class="h-full rounded-full transition-all duration-305" style="width: ${pct}%; background-color: ${color};"></div>
            </div>
          </div>
        `;
      }).join('') + `</div>`;
    } else if (chartType === 'line') {
      innerChartHtml = `
        <div class="h-28 flex items-end justify-between px-2 pt-4 relative select-none">
          <div class="absolute inset-x-0 bottom-0 border-b border-neutral-800"></div>
          ${chartData.map(item => {
            const pct = Math.max(10, Math.min(100, item.value));
            const color = item.color || primaryColor || '#E5A93C';
            return `
              <div class="flex flex-col items-center gap-1.5 flex-grow relative z-10 select-none">
                <span class="text-[9px] font-mono font-bold text-neutral-300 bg-neutral-900 py-0.5 px-1 rounded border border-neutral-855 select-none" style="border-color: ${color}44;">${item.value}</span>
                <div class="w-1.5 rounded-t transition-all duration-305" style="height: ${pct * 0.6}px; background-color: ${color};"></div>
                <span class="text-[8px] text-neutral-500 truncate max-w-[45px] mt-1 select-none">${item.label}</span>
              </div>
            `;
          }).join('')}
        </div>
      `;
    } else if (chartType === 'pie') {
      const colors = ['#eab308', '#3b82f6', '#ef4444', '#10b981', '#a855f7', '#f97316'];
      innerChartHtml = `
        <div class="flex items-center gap-4 py-2 select-none">
          <div class="w-14 h-14 rounded-full border border-neutral-800 shrink-0 flex items-center justify-center relative bg-gradient-to-tr from-yellow-500/10 to-neutral-800 select-none">
            <span class="text-lg animate-pulse">📊</span>
          </div>
          <div class="flex-grow grid grid-cols-2 gap-1.5 self-center select-none">
            ${chartData.slice(0, 6).map((item, idx) => {
              const color = item.color || colors[idx % colors.length];
              return `
                <div class="flex items-center gap-1.5 text-[10px] select-none">
                  <span class="w-2 h-2 rounded-full shrink-0 animate-scale-in" style="background-color: ${color};"></span>
                  <span class="text-zinc-400 truncate max-w-[70px] select-none">${item.label}:</span>
                  <span class="font-bold text-zinc-200 font-mono select-none">${item.value}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    } else if (chartType === 'table') {
      const parsedTable: string[][] = tableData || [['Tabella', 'Vuota']];
      const headers = parsedTable[0] || [];
      const rows = parsedTable.slice(1);

      // --- START AUTO-GENERATING CHARTS FOR TABLE IF NUMERIC COLUMNS DETECTED ---
      let chartsGridHtml = '';
      const numColumns = headers.length;
      if (numColumns > 0) {
        const colDataTypes: { isNumeric: boolean; numericValues: number[]; values: string[] }[] = [];

        for (let c = 0; c < numColumns; c++) {
          let numericValues: number[] = [];
          let values: string[] = [];
          let totalRows = rows.length;

          for (let r = 0; r < totalRows; r++) {
            const rawVal = (rows[r] && rows[r][c] !== undefined) ? rows[r][c] : '';
            values.push(rawVal);
            
            const cleaned = rawVal.replace(/[^\d.-]/g, '');
            const parsed = parseFloat(cleaned);
            
            if (rawVal.trim() !== '' && !isNaN(parsed)) {
              numericValues.push(parsed);
            }
          }

          const isNumeric = totalRows > 0 && (numericValues.length >= Math.ceil(totalRows * 0.5));

          colDataTypes.push({
            isNumeric,
            numericValues,
            values
          });
        }

        // Find Label Column (first text column)
        let labelColIndex = -1;
        for (let c = 0; c < numColumns; c++) {
          if (!colDataTypes[c].isNumeric) {
            labelColIndex = c;
            break;
          }
        }
        if (labelColIndex === -1) {
          labelColIndex = 0;
        }

        // Heuristic ID check
        let isIdCol = false;
        if (colDataTypes[0] && colDataTypes[0].isNumeric) {
          const vals = colDataTypes[0].numericValues;
          if (vals.length > 1 && vals[1] === vals[0] + 1) {
            isIdCol = true;
          }
        }
        if (isIdCol && numColumns > 1 && colDataTypes[1] && !colDataTypes[1].isNumeric) {
          labelColIndex = 1;
        }

        // Find Numeric columns to Graph
        const valueColIndices: number[] = [];
        for (let c = 0; c < numColumns; c++) {
          if (c !== labelColIndex && colDataTypes[c].isNumeric) {
            if (c === 0 && labelColIndex === 1) {
              continue;
            }
            valueColIndices.push(c);
          }
        }

        // Build Charts Horizontal Bars HTML
        let chartsHtml = '';
        const isSingleRowTable = rows.length === 1;

        if (isSingleRowTable) {
          const singleRow = rows[0];
          const numericDetails: { label: string; raw: string; val: number }[] = [];
          for (let c = 0; c < numColumns; c++) {
            const rawVal = singleRow[c] !== undefined ? singleRow[c] : '';
            const cleaned = rawVal.replace(/[^\d.-]/g, '');
            const val = parseFloat(cleaned);
            if (!isNaN(val)) {
              numericDetails.push({
                label: headers[c] || `Colonna ${c + 1}`,
                raw: rawVal,
                val: val
              });
            }
          }

          if (numericDetails.length > 0) {
            const maxVal = Math.max(...numericDetails.map(d => d.val), 1);
            let barRowsHtml = '';
            numericDetails.forEach(detail => {
              const pct = Math.max(3, Math.min(100, (detail.val / maxVal) * 100));
              barRowsHtml += `
                <div class="space-y-1 my-1">
                  <div class="flex justify-between text-[11px] text-zinc-400">
                    <span class="font-medium truncate max-w-[150px] text-zinc-300 font-sans">${detail.label}</span>
                    <span class="font-mono font-bold text-zinc-100">${detail.raw}</span>
                  </div>
                  <div class="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                    <div class="h-full rounded-full transition-all duration-300" style="width: ${pct}%; background-color: ${primaryColor || '#E5A93C'};"></div>
                  </div>
                </div>
              `;
            });

            chartsHtml = `
              <div class="p-3 bg-neutral-950/40 rounded-xl border border-neutral-800/80 my-1 select-text">
                <div class="border-b border-neutral-800 pb-1.5 mb-2 flex items-center gap-1.5">
                  <span class="text-[10px] font-bold text-yellow-500 uppercase tracking-wider">📈 Grafico Valori</span>
                </div>
                <div class="space-y-1.5 py-0.5">
                  ${barRowsHtml}
                </div>
              </div>
            `;
            chartsGridHtml = chartsHtml;
          }
        } else if (valueColIndices.length > 0) {
          const firstColIdx = valueColIndices[0];
          const colHeader = headers[firstColIdx];
          const colData = colDataTypes[firstColIdx];
          const maxVal = Math.max(...colData.numericValues, 1);
          const color = primaryColor || '#E5A93C';

          let barRowsHtml = '';
          for (let r = 0; r < rows.length; r++) {
            const rLabel = (rows[r] && rows[r][labelColIndex]) ? rows[r][labelColIndex] : `Riga ${r + 1}`;
            const rawVal = (rows[r] && rows[r][firstColIdx] !== undefined) ? rows[r][firstColIdx] : '';
            const cleaned = rawVal.replace(/[^\d.-]/g, '');
            const val = parseFloat(cleaned) || 0;
            const pct = Math.max(3, Math.min(100, (val / maxVal) * 100));

            barRowsHtml += `
              <div class="space-y-1 my-1">
                <div class="flex justify-between text-[11px] text-zinc-400 font-sans">
                  <span class="font-medium truncate max-w-[150px] text-zinc-300 font-sans">${rLabel}</span>
                  <span class="font-mono font-bold text-zinc-100">${rawVal}</span>
                </div>
                <div class="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                  <div class="h-full rounded-full transition-all duration-300" style="width: ${pct}%; background-color: ${color};"></div>
                </div>
              </div>
            `;
          }

          chartsHtml = `
            <div class="p-3 bg-neutral-950/40 rounded-xl border border-neutral-800/80 my-1 select-text">
              <div class="border-b border-neutral-800 pb-1.5 mb-2 flex items-center gap-1.5">
                <span class="text-[10px] font-bold text-yellow-500 uppercase tracking-wider">📈 ${colHeader}</span>
              </div>
              <div class="space-y-1.5 py-0.5">
                ${barRowsHtml}
              </div>
            </div>
          `;
          chartsGridHtml = chartsHtml;
        }
      }
      // --- END AUTO-GENERATING CHARTS FOR TABLE ---

      const tableNavToolbar = ``;

      const excelGridHtml = `
        <div class="excel-grid-container w-full overflow-x-auto select-text my-1 rounded-xl border border-neutral-800/80 bg-neutral-950 p-1.5 scrollbar-thin">
          <table class="w-full text-left border-collapse table-auto" style="font-size: 11px; width: 100%; min-width: max-content;">
            <thead>
              <tr class="bg-neutral-950 border-b border-neutral-800 font-mono text-[9px] text-neutral-500">
                <th class="p-1 text-center bg-neutral-950 border border-neutral-850 w-8 min-w-8 select-none"></th>
                 ${headers.map((_, hIdx) => {
                   const colBgColor = tableStyleSource?.colColors?.[hIdx] || '';
                   const style = colBgColor ? `background-color: ${colBgColor}22; border-bottom: 2px solid ${colBgColor};` : '';
                   return `
                    <th class="p-1 text-center bg-neutral-950/80 border border-neutral-850 select-none font-bold" style="${style}">${String.fromCharCode(65 + hIdx)}</th>
                   `;
                 }).join('')}
              </tr>
              <tr class="border-b border-neutral-800">
                <th class="p-1 px-1.5 text-center text-neutral-500 font-mono text-[10px] bg-neutral-950/70 border border-neutral-850 w-8 select-none">1</th>
                ${headers.map((h, hIdx) => {
                  const colBgColor = tableStyleSource?.colColors?.[hIdx] || '';
                  const colCellKey = `0,${hIdx}`;
                  const cellColor = tableStyleSource?.cellColors?.[colCellKey] || colBgColor;
                  const textColor = tableStyleSource?.textColors?.[colCellKey] || tableStyleSource?.rowTextColors?.[0] || tableStyleSource?.colTextColors?.[hIdx] || '';
                  const bgStyle = cellColor ? `background-color: ${cellColor}22; border-bottom: 2px solid ${cellColor};` : `background-color: rgba(255, 255, 255, 0.02);`;
                  const textStyle = textColor ? `color: ${textColor} !important; font-weight: bold;` : '';
                  return `
                    <th class="p-2 py-2 text-zinc-100 font-bold select-text uppercase tracking-wider text-[10px] border border-neutral-855" style="${bgStyle} ${textStyle}">${h || ''}</th>
                  `;
                }).join('')}
              </tr>
            </thead>
            <tbody>
              ${rows.map((row, rIdx) => {
                const actualExcelRow = rIdx + 2;
                const tableRowIdx = rIdx + 1; // 1-based indexing for rows (headers is 0)
                const rowBgColor = tableStyleSource?.rowColors?.[tableRowIdx] || '';
                const rowStyle = rowBgColor ? `background-color: ${rowBgColor}15;` : '';
                return `
                  <tr class="border-b border-neutral-900 hover:bg-neutral-900/30 transition-colors" style="${rowStyle}">
                    <td class="p-2 text-center text-neutral-500 font-mono text-[10px] bg-neutral-950/40 border border-neutral-850 w-8 select-none" style="${rowBgColor ? `border-left: 3px solid ${rowBgColor}; font-weight: bold;` : ''}">${actualExcelRow}</td>
                    ${headers.map((_, cIdx) => {
                      const rawVal = row[cIdx] || '';
                      const evaluated = evaluateExcelCell(rawVal, parsedTable);
                      
                      const cellKey = `${tableRowIdx},${cIdx}`;
                      const cellBgColor = tableStyleSource?.cellColors?.[cellKey];
                      const cellTextColor = tableStyleSource?.textColors?.[cellKey] || tableStyleSource?.rowTextColors?.[tableRowIdx] || tableStyleSource?.colTextColors?.[cIdx];
                      
                      let cellStyle = `white-space: pre-wrap !important; word-break: normal !important; overflow-wrap: break-word !important; word-wrap: break-word !important;`;
                      
                      // Background coloring logic
                      if (cellBgColor) {
                        cellStyle += ` background-color: ${cellBgColor}22 !important; border: 1px solid ${cellBgColor}55 !important;`;
                      } else {
                        // Inherit from column or row
                        const colBgColor = tableStyleSource?.colColors?.[cIdx];
                        if (colBgColor) {
                          cellStyle += ` background-color: ${colBgColor}10 !important;`;
                        } else if (rowBgColor) {
                          cellStyle += ` background-color: ${rowBgColor}10 !important;`;
                        }
                      }
                      
                      // Text color coloring logic
                      if (cellTextColor) {
                        cellStyle += ` color: ${cellTextColor} !important; font-weight: bold;`;
                      }
                      
                      return `
                        <td class="p-2 py-2 text-zinc-300 font-medium select-text border border-neutral-900/30" data-orig-value="${rawVal}" style="${cellStyle}">${evaluated}</td>
                      `;
                    }).join('')}
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;

      const excelCardHtml = `
        <div class="excel-card-container w-full select-text my-1 space-y-2 mt-2 hidden">
          ${rows.map((row, rIdx) => `
            <div class="p-3 bg-neutral-950/80 rounded-xl border border-neutral-850 space-y-1.5">
              <div class="flex items-center justify-between text-[9px] text-neutral-500 font-bold border-b border-neutral-900 pb-1.5">
                <span class="text-zinc-400 font-mono">DATI ROW #${rIdx + 2}</span>
                <span class="bg-yellow-500/10 text-yellow-500 px-1.5 py-0.5 rounded uppercase tracking-widest font-black" style="font-size: 8px;">RIGA ${rIdx + 2}</span>
              </div>
              <div class="grid grid-cols-2 gap-3 pt-1">
                ${headers.map((h, cIdx) => {
                  const rawVal = row[cIdx] || '';
                  const evaluated = evaluateExcelCell(rawVal, parsedTable);
                  return `
                    <div class="flex flex-col gap-0.5 min-w-0" data-orig-value="${rawVal}">
                      <span class="text-[9px] text-yellow-600 font-black uppercase tracking-wider truncate">${String.fromCharCode(65 + cIdx)}: ${h || `Colonna ${cIdx + 1}`}</span>
                      <span class="text-xs text-zinc-200 font-medium leading-relaxed" style="white-space: pre-wrap !important; word-break: normal !important; overflow-wrap: break-word !important; word-wrap: break-word !important;">${evaluated || '-'}</span>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      `;

      innerChartHtml = `
        ${chartsGridHtml}
        ${tableNavToolbar}
        ${excelGridHtml}
        ${excelCardHtml}
      `;
    }

    if (chartType === 'table') {
      return `
      <div class="media-widget relative p-1.5 my-2 bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-full select-none" contenteditable="false" style="width: 100%; min-width: 34px; transition: width 0.15s ease-out; vertical-align: middle; display: block; clear: both; margin: 8px auto;" data-widget-id="${id}" data-widget-type="chart" data-chart-type="table" data-table-view="grid">
        <div class="media-widget-resize-handle handle-br" title="Ridimensiona"></div>
        <div class="media-widget-resize-handle handle-bl" title="Ridimensiona"></div>
        <div class="media-widget-resize-handle handle-r" title="Allarga/Stringi"></div>
        <div class="media-widget-resize-handle handle-b" title="Schiaccia/Allunga"></div>
        <div class="media-controls flex flex-nowrap items-center justify-center bg-neutral-950 border border-neutral-800 rounded-xl p-1 gap-1 mb-2 shadow-lg text-neutral-300 w-full select-none hidden" style="min-width: max-content;">
          <button type="button" class="media-widget-btn-scale-down p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center" title="Rimpicciolisci"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="rotate-180"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg></button>
          <button type="button" class="media-widget-btn-scale-up p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center" title="Ingrandisci"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg></button>
          
          <!-- Wrap Left, Clear/None, Wrap Right controls -->
          <button type="button" class="media-widget-btn-wrap-left p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center" title="Testo scorre a destra">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="12" x2="10" y2="12"></line><line x1="21" y1="18" x2="10" y2="18"></line><rect x="3" y="10" width="5" height="10" rx="1"></rect></svg>
          </button>
          <button type="button" class="media-widget-btn-wrap-none p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center" title="Nessun allineamento">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="12" x2="3" y2="12"></line><line x1="21" y1="18" x2="3" y2="18"></line></svg>
          </button>
          <button type="button" class="media-widget-btn-wrap-right p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center" title="Testo scorre a sinistra">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" y1="6" x2="3" y2="6"></line><line x1="14" y1="12" x2="3" y2="12"></line><line x1="14" y1="18" x2="3" y2="18"></line><rect x="16" y="10" width="5" height="10" rx="1"></rect></svg>
          </button>

          <!-- Drag and drop reordering handle -->
          <button type="button" class="media-widget-btn-drag-move p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 flex items-center justify-center pointer-events-auto cursor-grab" title="Trascina per spostare">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="5 9 2 12 5 15"></polyline>
              <polyline points="9 5 12 2 15 5"></polyline>
              <polyline points="15 19 12 22 9 19"></polyline>
              <polyline points="19 9 22 12 19 15"></polyline>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <line x1="12" y1="2" x2="12" y2="22"></line>
            </svg>
          </button>

          <!-- Eyeball toggle preview fullscreen trigger -->
          <button type="button" class="media-widget-btn-toggle-preview p-1.5 rounded hover:bg-neutral-800 text-amber-500 hover:text-amber-400 flex items-center justify-center" title="Schermo Intero">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </button>

          <button type="button" class="media-widget-btn-edit-chart p-1.5 rounded hover:bg-neutral-800 text-amber-500 hover:text-amber-400 flex items-center justify-center" title="Modifica Tabella">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          
          <button type="button" class="media-widget-btn-move-up p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center" title="Sposta Su"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg></button>
          <button type="button" class="media-widget-btn-move-down p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center" title="Sposta Giù"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg></button>
          <button type="button" class="media-widget-btn-delete p-1.5 rounded hover:bg-neutral-800 text-red-500 hover:text-red-400 flex items-center justify-center" title="Elimina"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
          <button type="button" class="media-widget-btn-confirm ml-1 px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-[9px] uppercase tracking-wider transition-colors duration-100 shrink-0" title="Conferma">Conferma</button>
        </div>
        <div class="media-widget-body bg-transparent p-0 flex flex-col select-none overflow-auto" style="width: 100%; height: 100%; min-height: inherit;">
          ${innerChartHtml}
        </div>
      </div>
      <span>&nbsp;</span>
      `;
    }

    return `
    <div class="media-widget relative p-3 my-2 bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-full select-none" contenteditable="false" style="width: 100%; min-width: 34px; transition: width 0.15s ease-out; vertical-align: middle; display: block; clear: both; margin: 8px auto;" data-widget-id="${id}" data-widget-type="chart">
      <div class="media-widget-resize-handle handle-br" title="Ridimensiona"></div>
      <div class="media-widget-resize-handle handle-bl" title="Ridimensiona"></div>
      <div class="media-widget-resize-handle handle-r" title="Allarga/Stringi"></div>
      <div class="media-widget-resize-handle handle-b" title="Schiaccia/Allunga"></div>
      <div class="media-controls flex flex-nowrap items-center justify-center bg-neutral-950 border border-neutral-800 rounded-xl p-1 gap-1 mb-2 shadow-lg text-neutral-300 w-full select-none hidden" style="min-width: max-content;">
        <button type="button" class="media-widget-btn-scale-down p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center" title="Rimpicciolisci"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="rotate-180"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg></button>
        <button type="button" class="media-widget-btn-scale-up p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center" title="Ingrandisci"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg></button>
        
        <button type="button" class="media-widget-btn-edit-chart p-1.5 rounded hover:bg-neutral-800 text-amber-500 hover:text-amber-400 flex items-center justify-center" title="Modifica Grafico">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>

        <button type="button" class="media-widget-btn-move-up p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center" title="Sposta Su"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg></button>
        <button type="button" class="media-widget-btn-move-down p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center" title="Sposta Giù"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg></button>
        <button type="button" class="media-widget-btn-delete p-1.5 rounded hover:bg-neutral-800 text-red-500 hover:text-red-400 flex items-center justify-center" title="Elimina"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
        <button type="button" class="media-widget-btn-confirm ml-1 px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-[9px] uppercase tracking-wider transition-colors duration-100 shrink-0" title="Conferma">Conferma</button>
      </div>
      <div class="media-widget-body bg-neutral-900/50 p-3 rounded-xl flex flex-col gap-2 select-none">
        <div class="border-b border-neutral-855 pb-2 mb-1 select-none">
          <span class="text-[10px] font-bold text-yellow-500 uppercase tracking-wider select-none">📈 ${`Grafico ${chartType === 'bar' ? 'a Barre' : chartType === 'pie' ? 'a Torta' : 'a Linee'}`}</span>
        </div>
        ${innerChartHtml}
      </div>
    </div>
    <span>&nbsp;</span>
    `;
  };

  const getHtmlForFile = (url: string, name: string, size: string, id: string) => `
  <div class="media-widget relative p-2 my-1 bg-[#0d0d11]/90 border border-neutral-800 rounded-xl select-none" contenteditable="false" style="display: block; transition: width 0.15s ease-out; max-width: 100%; min-width: 25px; clear: both; margin: 8px auto; width: 100%;" data-widget-id="${id}" data-widget-type="file">
    <div class="media-controls flex flex-nowrap items-center justify-center bg-neutral-950 border border-neutral-800 rounded-xl p-1 gap-1 mb-2 shadow-lg text-neutral-300 w-full select-none" style="min-width: max-content;">
      <button type="button" class="media-widget-btn-scale-down p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center" title="Rimpicciolisci"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="rotate-180"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg></button>
      <button type="button" class="media-widget-btn-scale-up p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center" title="Ingrandisci"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg></button>
      
      <!-- Wrap Left, Clear/None, Wrap Right controls -->
      <button type="button" class="media-widget-btn-wrap-left p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center" title="Testo scorre a destra">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="12" x2="10" y2="12"></line><line x1="21" y1="18" x2="10" y2="18"></line><rect x="3" y="10" width="5" height="10" rx="1"></rect></svg>
      </button>
      <button type="button" class="media-widget-btn-wrap-none p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center" title="Nessun allineamento">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="12" x2="3" y2="12"></line><line x1="21" y1="18" x2="3" y2="18"></line></svg>
      </button>
      <button type="button" class="media-widget-btn-wrap-right p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center" title="Testo scorre a sinistra">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" y1="6" x2="3" y2="6"></line><line x1="14" y1="12" x2="3" y2="12"></line><line x1="14" y1="18" x2="3" y2="18"></line><rect x="16" y="10" width="5" height="10" rx="1"></rect></svg>
      </button>
 
      <button type="button" class="media-widget-btn-move-up p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center" title="Sposta Su"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg></button>
      <button type="button" class="media-widget-btn-move-down p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center" title="Sposta Giù"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg></button>
      <button type="button" class="media-widget-btn-delete p-1.5 rounded hover:bg-neutral-800 text-red-500 hover:text-red-400 flex items-center justify-center" title="Elimina"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
      <button type="button" class="media-widget-btn-confirm ml-1 px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-[9px] uppercase tracking-wider transition-colors duration-100 shrink-0" title="Conferma">Conferma</button>
    </div>
    <div class="flex items-center gap-2 text-neutral-300 select-none text-left mb-2">
      <div class="w-7 h-7 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 select-none">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-neutral-400 shrink-0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
      </div>
      <span class="text-xs font-semibold text-neutral-200 select-none">Allegato File</span>
    </div>
    <a href="${url}" download="${name}" class="text-[10px] bg-neutral-800 hover:bg-neutral-750 text-white font-bold py-1 px-2.5 rounded-xl shrink-0">Download</a>
  </div>
  <span>&nbsp;</span>
  `;

  const getLinkWidgetInnerHtml = (url: string, name: string, showPreview: boolean, id: string, domain: string) => {
    const previewStateText = showPreview ? "Nascondi Anteprima" : "Mostra Anteprima";
    const faviconUrl = `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
    
    return `
    <div class="media-controls flex flex-nowrap items-center justify-center bg-neutral-950 border border-neutral-800 rounded-xl p-1 gap-1 mb-2 shadow-lg text-neutral-300 w-full select-none animate-in fade-in zoom-in duration-100" style="min-width: max-content;">
      <button type="button" class="media-widget-btn-scale-down p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center" title="Rimpicciolisci"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="rotate-180"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg></button>
      <button type="button" class="media-widget-btn-scale-up p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center" title="Ingrandisci"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg></button>
      
      <button type="button" class="media-widget-btn-toggle-preview p-1.5 rounded hover:bg-neutral-800 text-amber-500 hover:text-amber-400 flex items-center justify-center" title="${previewStateText}">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"/><circle cx="12" cy="12" r="3"/></svg>
      </button>

      <button type="button" class="media-widget-btn-wrap-left p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center" title="Testo scorre a destra">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="12" x2="10" y2="12"></line><line x1="21" y1="18" x2="10" y2="18"></line><rect x="3" y="10" width="5" height="10" rx="1"></rect></svg>
      </button>
      <button type="button" class="media-widget-btn-wrap-none p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center" title="Nessun allineamento">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="12" x2="3" y2="12"></line><line x1="21" y1="18" x2="3" y2="18"></line></svg>
      </button>
      <button type="button" class="media-widget-btn-wrap-right p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center" title="Testo scorre a sinistra">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" y1="6" x2="3" y2="6"></line><line x1="14" y1="12" x2="3" y2="12"></line><line x1="14" y1="18" x2="3" y2="18"></line><rect x="16" y="10" width="5" height="10" rx="1"></rect></svg>
      </button>
 
      <button type="button" class="media-widget-btn-move-up p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center" title="Sposta Su"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg></button>
      <button type="button" class="media-widget-btn-move-down p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center" title="Sposta Giù"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg></button>
      <button type="button" class="media-widget-btn-delete p-1.5 rounded hover:bg-neutral-800 text-red-500 hover:text-red-400 flex items-center justify-center" title="Elimina"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
      <button type="button" class="media-widget-btn-confirm ml-1 px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-[9px] uppercase tracking-wider transition-colors duration-100 shrink-0" title="Conferma">Conferma</button>
    </div>

    ${showPreview 
      ? `
        <!-- Beautiful horizontal preview card layout (100% width default) -->
        <div class="media-widget-link-go relative bg-neutral-950 hover:bg-neutral-900 border border-neutral-800 hover:border-amber-500/40 rounded-xl flex items-center p-3 cursor-pointer select-none transition-all duration-100 gap-3" style="min-height: 64px; width: 100%; text-align: left;" data-href="${url}">
          <div class="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shrink-0 select-none">
            <img src="${faviconUrl}" class="w-6 h-6 object-contain rounded-md" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'16\\' height=\\'16\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'%23f59e0b\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><path d=\\'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71\\'/><path d=\\'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71\\'/></svg>';this.onerror=null;" />
          </div>
          <div class="flex-grow min-w-0 flex flex-col text-left">
            <span class="text-xs font-bold text-neutral-100 truncate leading-tight select-none">${name || url}</span>
            <span class="text-[9px] font-medium text-amber-500 mt-1 truncate leading-none select-none uppercase tracking-wider">${domain}</span>
          </div>
          <div class="w-6 h-6 rounded-lg bg-neutral-900 flex items-center justify-center text-neutral-400 shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
          </div>
        </div>
      `
      : `
        <!-- Minimal square badge layout: un elegante "quadratino" contentente unicamente il tasto del link, come richiesto -->
        <div class="media-widget-link-go relative bg-neutral-950 hover:bg-neutral-900 border border-neutral-800 hover:border-amber-500/40 rounded-xl flex items-center justify-center cursor-pointer select-none transition-all duration-150 shadow-md transform active:scale-95 shrink-0" 
             style="width: 44px; height: 44px; display: inline-flex;" 
             data-href="${url}" 
             title="Vai a: ${name || url}">
          <div class="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-500 to-purple-600 flex items-center justify-center text-white hover:scale-105 transition-transform shadow-md shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          </div>
        </div>
      `
    }
    `;
  };

  const getHtmlForLink = (url: string, name: string, showPreview: boolean, id: string) => {
    const previewAttr = showPreview ? 'true' : 'false';
    const displayStyle = showPreview ? 'block' : 'inline-block';
    const marginStyle = showPreview ? '8px auto' : '2px 4px';
    const widthStyle = showPreview ? '100%' : 'auto';
    
    let domain = 'link';
    try {
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
      domain = parsed.hostname;
    } catch (err) {}

    const innerHTML = getLinkWidgetInnerHtml(url, name, showPreview, id, domain);

    return `
    <div class="media-widget relative p-1.5 my-1 bg-neutral-900/60 border border-neutral-800 rounded-xl select-none" 
         contenteditable="false" 
         style="width: ${widthStyle}; min-width: 25px; transition: all 0.15s ease-out; vertical-align: middle; display: ${displayStyle}; clear: none; margin: ${marginStyle};" 
         data-widget-id="${id}" 
         data-widget-type="link" 
         data-url="${url}" 
         data-name="${name}" 
         data-show-preview="${previewAttr}">
      ${innerHTML}
    </div>
    <span>&nbsp;</span>
    `;
  };

  // High performance, lightweight canvas image compressor to prevent lag and storage crashes (QuotaExceeded)
  const compressImage = (base64Str: string, maxWidth = 800, maxHeight = 800, quality = 0.60): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#171717';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', quality);
          resolve(compressed);
        } else {
          resolve(base64Str);
        }
      };
      img.onerror = () => {
        resolve(base64Str);
      };
      img.src = base64Str;
    });
  };

  // File Upload Handlers (Images, Video, Audio, Generic File) WITH INLINE WORD-LIKE INJECTION
  const handleAttachLocalFile = (type: 'image' | 'video' | 'audio' | 'file') => {
    // Save current selection range first if any is active right now
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      setSelectionRange(selection.getRangeAt(0));
    }

    // Blur the editor to prevent mobile WebViews on Android/iOS from pasting the selected filename as text
    if (editorRef.current) {
      editorRef.current.blur();
    }

    const input = document.createElement('input');
    input.type = 'file';
    
    if (type === 'image') input.accept = 'image/*';
    else if (type === 'video') input.accept = 'video/*';
    else if (type === 'audio') input.accept = 'audio/*';
    else input.accept = '*/*';

    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const sizeStr = (file.size / 1024).toFixed(1) + ' KB';
      const reader = new FileReader();
      
      reader.onload = async () => {
        let urlStr = reader.result as string;

        if (type === 'image') {
          try {
            urlStr = await compressImage(urlStr);
          } catch (err) {
            console.error("Image compression failed", err);
          }
        }

        const newAttachment: Attachment = {
          id: 'att-' + Date.now(),
          type,
          name: file.name,
          url: urlStr,
          size: sizeStr,
          width: 100 // default max container width
        };

        // Insert inside current note's attachments array for tracking
        setNotes(prev => prev.map(n => {
          if (n.id === currentNoteId) {
            return {
              ...n,
              attachments: [...n.attachments, newAttachment],
              updatedAt: Date.now()
            };
          }
          return n;
        }));

        // Dynamically inject inline HTML template directly into cursor caret area
        let markup = '';
        if (type === 'image') {
          markup = getHtmlForImage(urlStr, file.name, sizeStr, newAttachment.id);
        } else if (type === 'video') {
          markup = getHtmlForVideo(urlStr, file.name, sizeStr, newAttachment.id);
        } else if (type === 'audio') {
          markup = getHtmlForAudio(urlStr, file.name, sizeStr, newAttachment.id);
        } else {
          markup = getHtmlForFile(urlStr, file.name, sizeStr, newAttachment.id);
        }

        applyStyle('insertHTML', markup);
        setIsWidgetEditing(true);
      };
      
      reader.readAsDataURL(file);
    };

    input.click();
  };

  // Canvas Drawing Saver with inline template injection
  const handleSaveDrawing = (canvasDataUrl: string) => {
    if (!currentNoteId) return;

    const attachmentId = 'drawing-' + Date.now();
    const drawingAttachment: Attachment = {
      id: attachmentId,
      type: 'drawing',
      name: 'Schizzo Mano Libera',
      url: canvasDataUrl,
      width: 100
    };

    setNotes(prev => prev.map(n => {
      if (n.id === currentNoteId) {
        return {
          ...n,
          attachments: [...n.attachments, drawingAttachment],
          updatedAt: Date.now()
        };
      }
      return n;
    }));

    // Inject inline HTML drawing widget at selection
    const markup = getHtmlForDrawing(canvasDataUrl, attachmentId);
    applyStyle('insertHTML', markup);
    setIsWidgetEditing(true);

    setIsDrawingOpen(false);
  };

  const handleOpenFullscreenWidget = (widget: HTMLElement) => {
    const widgetId = widget.getAttribute('data-widget-id') || '';
    const activeNote = notes.find(n => n.id === currentNoteId) || notesRef.current.find(n => n.id === currentNoteId);
    const attachment = activeNote?.attachments?.find(att => att.id === widgetId);
    
    const widgetType = widget.getAttribute('data-widget-type');
    const chartType = widget.getAttribute('data-chart-type') || (attachment ? attachment.chartType : null);

    if (widgetType === 'chart' || chartType === 'table' || widget.querySelector('table')) {
      if (chartType === 'table' || widget.querySelector('table')) {
        const tData = attachment?.tableData || scrapeTableDataFromWidget(widget);
        const tStyles = attachment?.tableStyles || null;
        if (tData && tData.length > 0) {
          setFullscreenTableData(tData);
          setFullscreenTableStyles(tStyles);
          setFullscreenMediaType('table');
          setFullscreenMediaUrl('table');
        }
      } else {
        // It's a non-table chart (bar, line, pie)
        const type = chartType || 'bar';
        const items = attachment?.chartData || [];
        const name = attachment?.name || 'Grafico';
        
        setFullscreenChartType(type as any);
        setFullscreenChartItems(items);
        setFullscreenChartName(name);
        setFullscreenMediaType('chart');
        setFullscreenMediaUrl('chart');
      }
      return true;
    }
    return false;
  };

  const parseMarkdownTable = (md: string): string[][] | null => {
    if (!md || !md.trim()) return null;
    const lines = md.trim().split('\n');
    const parsedRows: string[][] = [];
    
    for (let line of lines) {
      line = line.trim();
      if (!line) continue;
      
      // Check if it's a separator line (e.g., |---|---| or | :--- | :---: | or similar)
      const isSeparator = line.replace(/[\|:\-\s]/g, '') === '';
      if (isSeparator && parsedRows.length > 0) {
        continue; // Skip separator line if we already started parsing
      }
      
      // Split by '|'
      let parts = line.split('|');
      
      // If line starts with '|', the first element of split is empty. Remove it
      if (line.startsWith('|')) {
        parts.shift();
      }
      // If line ends with '|', the last element is empty. Remove it
      if (line.endsWith('|') && parts.length > 0) {
        parts.pop();
      }
      
      const cleanCells = parts.map(cell => cell.trim());
      
      // If it contains only empty strings and is separator-like, skip
      if (cleanCells.length === 0 || (cleanCells.length === 1 && cleanCells[0] === '')) {
        continue;
      }
      
      parsedRows.push(cleanCells);
    }
    
    return parsedRows.length > 0 ? parsedRows : null;
  };

  const scrapeTableDataFromWidget = (widget: HTMLElement): string[][] => {
    const tbody = widget.querySelector('tbody');
    const thead = widget.querySelector('thead');
    if (!tbody || !thead) {
      // Fallback for simple classic flat tables
      const table = widget.querySelector('table');
      if (!table) return [];
      const rows: string[][] = [];
      const headerCols: string[] = [];
      table.querySelectorAll('thead th').forEach(th => {
        headerCols.push(th.textContent?.trim() || '');
      });
      if (headerCols.length > 0) rows.push(headerCols);
      table.querySelectorAll('tbody tr').forEach(tr => {
        const rowCols: string[] = [];
        tr.querySelectorAll('td').forEach(td => {
          const origVal = td.getAttribute('data-orig-value');
          rowCols.push(origVal !== null ? origVal : td.textContent?.trim() || '');
        });
        if (rowCols.length > 0) rows.push(rowCols);
      });
      return rows;
    }

    const rows: string[][] = [];
    const headerTrs = thead.querySelectorAll('tr');
    // The second row of our table heads is the actual clean text header row
    const realHeaderTr = headerTrs.length > 1 ? headerTrs[1] : headerTrs[0];
    if (realHeaderTr) {
      const headerCols: string[] = [];
      const ths = Array.from(realHeaderTr.querySelectorAll('th'));
      const startIdx = realHeaderTr.querySelectorAll('th').length > 1 && ths[0].textContent?.trim() === '1' ? 1 : 0;
      for (let i = startIdx; i < ths.length; i++) {
        headerCols.push(ths[i].textContent?.trim() || '');
      }
      if (headerCols.length > 0) {
        rows.push(headerCols);
      }
    }

    tbody.querySelectorAll('tr').forEach(tr => {
      const rowCols: string[] = [];
      const tds = Array.from(tr.querySelectorAll('td'));
      const hasRowIndex = tds.length > 1 && /^\d+$/.test(tds[0].textContent?.trim() || '');
      const startIdx = hasRowIndex ? 1 : 0;
      for (let i = startIdx; i < tds.length; i++) {
        const origVal = tds[i].getAttribute('data-orig-value');
        rowCols.push(origVal !== null ? origVal : tds[i].textContent?.trim() || '');
      }
      if (rowCols.length > 0) {
        rows.push(rowCols);
      }
    });
    return rows;
  };

  const handleStartEditChartWidget = (widgetId: string, widgetEl: HTMLElement) => {
    // Determine note
    const activeNote = notesRef.current.find(n => n.id === currentNoteId);
    let attachment = activeNote?.attachments.find(att => att.id === widgetId);

    let title = 'Grafico';
    let type: 'bar' | 'line' | 'pie' | 'table' = 'bar';
    let items: { label: string; value: number }[] = [];
    let cells: string[][] = [
      ['', '', ''],
      ['', '', ''],
      ['', '', '']
    ];

    if (attachment) {
      title = attachment.name;
      type = attachment.chartType || 'bar';
      if (attachment.chartData) {
        items = attachment.chartData.map(it => ({ ...it }));
      }
      if (attachment.tableData) {
        cells = attachment.tableData.map(row => [...row]);
      }
      setTableStyles(attachment.tableStyles || {});
    } else {
      setTableStyles({});
      // Scrape fallback from HTML
      type = (widgetEl.getAttribute('data-chart-type') as any) || 'bar';
      const titleSpan = widgetEl.querySelector('span') || widgetEl.querySelector('.font-bold');
      if (titleSpan) {
        const fullTxt = titleSpan.textContent || '';
        title = fullTxt.replace(/^📈\s*/, '').trim();
      }

      if (type === 'table') {
        const parsed = scrapeTableDataFromWidget(widgetEl);
        if (parsed) {
          cells = parsed;
        }
      } else {
        items = [
          { label: 'A', value: 30 },
          { label: 'B', value: 65 }
        ];
      }
    }

    setEditingChartId(widgetId);
    setChartTitle(title);
    setChartType(type);
    setChartItems(items.length > 0 ? items : [{ label: '', value: 0 }, { label: '', value: 0 }, { label: '', value: 0 }]);
    setTableCells(cells);
    if (type === 'table') {
      const md = cells.map(row => '| ' + row.join(' | ') + ' |').join('\n');
      setTableMarkdown(md);
    } else {
      setTableMarkdown('');
    }

    setColorPickerIndex(null);
    setChartBuilderOpen(true);
  };

  // Wire up ref
  handleStartEditChartWidgetRef.current = handleStartEditChartWidget;

  // Chart Insertion or Modification Click
  const handleInsertChart = () => {
    if (!currentNoteId) return;

    const chartId = editingChartId || ('chart-' + Date.now());
    const chartDataFiltered = chartItems.filter(item => item.label.trim() !== '');

    const chartAttachment: Attachment = {
      id: chartId,
      type: 'chart',
      name: chartTitle || (chartType === 'table' ? 'Tabella' : 'Grafico personalizzato'),
      url: '',
      chartType,
      chartData: chartType === 'table' ? [] : chartDataFiltered,
      tableData: chartType === 'table' ? tableCells : undefined,
      tableStyles: chartType === 'table' ? tableStyles : undefined
    };

    setNotes(prev => prev.map(n => {
      if (n.id === currentNoteId) {
        const exists = n.attachments.some(att => att.id === chartId);
        const nextAttachments = exists
          ? n.attachments.map(att => att.id === chartId ? chartAttachment : att)
          : [...n.attachments, chartAttachment];
        return {
          ...n,
          attachments: nextAttachments,
          updatedAt: Date.now()
        };
      }
      return n;
    }));

    // Inject compiled static SVG widget with primary configuration matching the active selection
    const markup = getHtmlForChart(
      chartTitle || (chartType === 'table' ? 'Tabella' : 'Grafico personalizzato'),
      chartType,
      chartType === 'table' ? [] : chartDataFiltered,
      settings.primaryColor || '#E5A93C',
      chartId,
      chartType === 'table' ? tableCells : undefined,
      chartType === 'table' ? tableStyles : undefined
    );

    const editorEl = editorRef.current;
    if (editingChartId && editorEl) {
      const widgetEl = editorEl.querySelector(`[data-widget-id="${editingChartId}"]`);
      if (widgetEl) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = markup;
        const newWidgetEl = tempDiv.querySelector('.media-widget');
        if (newWidgetEl) {
          // Retain manual styling attributes if present
          const oldStyle = widgetEl.getAttribute('style');
          if (oldStyle) {
            newWidgetEl.setAttribute('style', oldStyle);
          }
          const oldView = widgetEl.getAttribute('data-table-view');
          if (oldView) {
            newWidgetEl.setAttribute('data-table-view', oldView);
          }
          widgetEl.replaceWith(newWidgetEl);
        } else {
          widgetEl.outerHTML = markup;
        }
      } else {
        applyStyle('insertHTML', markup);
      }
    } else {
      applyStyle('insertHTML', markup);
    }

    handleEditorChange();
    setIsWidgetEditing(true);
    setChartBuilderOpen(false);
    setEditingChartId(null);
  };

  const handleInsertLink = () => {
    if (!currentNoteId) return;

    const linkId = 'link-' + Date.now();
    const cleanUrl = linkUrl.trim();
    const cleanLabel = linkLabel.trim() || 'Link';

    if (!cleanUrl) return;

    const linkAttachment: Attachment = {
      id: linkId,
      type: 'link',
      name: cleanLabel,
      url: cleanUrl
    };

    setNotes(prev => prev.map(n => {
      if (n.id === currentNoteId) {
        return {
          ...n,
          attachments: [...n.attachments, linkAttachment],
          updatedAt: Date.now()
        };
      }
      return n;
    }));

    const markup = getHtmlForLink(cleanUrl, cleanLabel, linkShowPreview, linkId);
    applyStyle('insertHTML', markup);
    setIsWidgetEditing(true);
    setLinkBuilderOpen(false);

    // Reset fields
    setLinkUrl('');
    setLinkLabel('');
  };

  // Sort attachment item order or scale width
  const handleResizeAttachment = (attId: string, deltaWidth: number) => {
    setNotes(prev => prev.map(n => {
      if (n.id === currentNoteId) {
        return {
          ...n,
          attachments: n.attachments.map(att => {
            if (att.id === attId) {
              const currentW = att.width || 100;
              const nextW = Math.max(25, Math.min(100, currentW + deltaWidth));
              return { ...att, width: nextW };
            }
            return att;
          })
        };
      }
      return n;
    }));
  };

  const handleOrderAttachment = (attId: string, direction: 'up' | 'down') => {
    setNotes(prev => prev.map(n => {
      if (n.id === currentNoteId) {
        const idx = n.attachments.findIndex(att => att.id === attId);
        if (idx === -1) return n;
        
        const nextAttachments = [...n.attachments];
        if (direction === 'up' && idx > 0) {
          const temp = nextAttachments[idx];
          nextAttachments[idx] = nextAttachments[idx - 1];
          nextAttachments[idx - 1] = temp;
        } else if (direction === 'down' && idx < nextAttachments.length - 1) {
          const temp = nextAttachments[idx];
          nextAttachments[idx] = nextAttachments[idx + 1];
          nextAttachments[idx + 1] = temp;
        }
        return { ...n, attachments: nextAttachments };
      }
      return n;
    }));
  };

  const handleRemoveAttachment = (attId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: settings.language === 'it' ? 'Rimuovi Allegato' : 'Remove Attachment',
      description: settings.language === 'it' ? 'Rimuovere questo allegato dalla nota?' : 'Remove this attachment from the note?',
      confirmText: settings.language === 'it' ? 'Rimuovi' : 'Remove',
      cancelText: settings.language === 'it' ? 'Annulla' : 'Cancel',
      isDestructive: true,
      onConfirm: () => {
        setNotes(prev => prev.map(n => {
          if (n.id === currentNoteId) {
            return {
              ...n,
              attachments: n.attachments.filter(att => att.id !== attId)
            };
          }
          return n;
        }));
        setConfirmDialog(null);
      }
    });
  };

  // --- PASSWORD LOCK SECURITY SYSTEM ---
  const handleSetPasswordToNote = (targetId?: string) => {
    const noteId = targetId || currentNoteId;
    if (!noteId) return;
    
    const pass = prompt(t.setPassword);
    if (pass === null) return; // user cancelled
    
    if (pass.trim() === '') {
      // disable lock
      setNotes(prev => prev.map(n => n.id === noteId ? { ...n, passwordLocked: false, password: '' } : n));
      alert(settings.language === 'it' ? 'Protezione password rimossa!' : 'Password protection removed!');
    } else {
      // apply lock
      setNotes(prev => prev.map(n => n.id === noteId ? { ...n, passwordLocked: true, password: pass.trim() } : n));
      // immediately unlock in session
      setUnlockedSessionKeys(prev => ({ ...prev, [noteId]: true }));
      alert(settings.language === 'it' ? 'Nota bloccata con successo!' : 'Note locked successfully!');
    }
  };

  const triggerNoteSelectionWithLockCheck = (note: Note) => {
    if (note.passwordLocked && !unlockedSessionKeys[note.id]) {
      setUnlockNoteIdTarget(note.id);
      setUnlockPasswordInput('');
    } else {
      setCurrentNoteId(note.id);
      setCurrentView('editor');
    }
  };

  const handleVerifyUnlockPassword = () => {
    if (!unlockNoteIdTarget) return;
    const targetNote = notes.find(n => n.id === unlockNoteIdTarget);
    if (targetNote && targetNote.password === unlockPasswordInput) {
      setUnlockedSessionKeys(prev => ({ ...prev, [unlockNoteIdTarget]: true }));
      setCurrentNoteId(unlockNoteIdTarget);
      setUnlockNoteIdTarget(null);
      setCurrentView('editor');
    } else {
      alert(t.wrongPassword);
    }
  };

  // --- MARKDOWN AUTO CONVERSION IMPORTER ---
  const handlePasteMarkdownManual = () => {
    if (!pastedMarkdownString.trim()) return;

    const htmlOutput = mdToHtml(pastedMarkdownString);
    
    // Create new note with Markdown title
    const mdLines = pastedMarkdownString.trim().split('\n');
    let titleStr = mdLines[0] ? mdLines[0].replace(/^#+\s*/, '') : 'ChatGPT Markdown Note';
    if (titleStr.length > 40) titleStr = titleStr.substring(0, 38) + '...';

    const newNoteId = 'note-' + Date.now();
    const newNote: Note = {
      id: newNoteId,
      folderId: selectedFolderId && selectedFolderId !== 'f-all' ? selectedFolderId : 'f-notes',
      title: titleStr,
      content: htmlOutput,
      pinned: false,
      passwordLocked: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      attachments: []
    };

    setNotes(prev => [newNote, ...prev]);
    setPastedMarkdownString('');
    setShowMarkdownImportAlert(false);
    setCurrentNoteId(newNoteId);
    setCurrentView('editor');
    alert(t.markdownSuccess);
  };

  const handlePasteMarkdownInEditor = () => {
    if (!editorMarkdownString.trim()) return;
    const htmlOutput = mdToHtml(editorMarkdownString);
    applyStyle('insertHTML', htmlOutput);
    setEditorMarkdownString('');
    setShowEditorMarkdownImport(false);
  };

  // --- DOWNLOAD PORTABLE OFFLINE APPLICATION IN REALTIME ---
  const handleDownloadApp = async (type: 'html' | 'zip' | 'src') => {
    setIsPackingApp(true);
    try {
      let response;
      if (type === 'html') {
        response = await fetch(`/api/download-app?type=${type}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            notes,
            folders,
            settings
          })
        });
      } else {
        response = await fetch(`/api/download-app?type=${type}`);
      }

      if (!response.ok) {
        throw new Error(await response.text() || 'Download error');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      let filename = 'note_android_offline.html';
      if (type === 'zip') filename = 'note_android_build.zip';
      if (type === 'src') filename = 'note_android_sorgente.zip';

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Packer response error:", error);
      alert(
        settings.language === 'it'
          ? `Impossibile completare il download: ${error instanceof Error ? error.message : "problemi di server"}`
          : `Could not finish download: ${error instanceof Error ? error.message : "server issue"}`
      );
    } finally {
      setIsPackingApp(false);
    }
  };

  // --- SINGLE EXPORT BUTTONS ---
  const handleExportTextFile = (note: Note, event?: React.MouseEvent) => {
    if (event) event.stopPropagation();
    
    const plainText = note.title + '\n\n' + note.content.replace(/<[^>]*>/g, '');
    const blob = new Blob([plainText], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = note.title.replace(/[\/\\?%*:|"<>\s]+/g, '_') + '.txt';
    link.click();
  };

  const handleExportFolderNotes = (folderId: string) => {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return;

    const folderNotes = notes.filter(n => n.folderId === folderId);
    if (folderNotes.length === 0) {
      alert(settings.language === 'it' ? 'Questa cartella non contiene alcuna nota da esportare.' : 'This folder contains no notes to export.');
      return;
    }

    const payload = JSON.stringify(folderNotes, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Caretlla_${folder.name.replace(/\s+/g, '_')}_Backup.json`;
    link.click();
  };

  // --- STANDALONE FULL FILE BUILDER ---
  const handleBuildStandaloneApplication = () => {
    const htmlCode = generateStandaloneHtml(notes, folders, settings);
    const blob = new Blob([htmlCode], { type: 'text/html;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'Note Android.html';
    link.click();
  };

  // --- ANDROID ZIP EXPORT & IMPORT ENGINE ---
  const handleExportAndroidZip = async () => {
    try {
      const zip = new JSZip();
      
      // Create data.json payload with complete state for loss-free backup
      const dataPayload = {
        version: "1.0",
        exportedAt: Date.now(),
        folders,
        notes
      };
      
      zip.file("data.json", JSON.stringify(dataPayload, null, 2));

      // Recursive path builder to place human-readable backup files inside nice folder structures
      const getFolderPath = (folderId: string): string => {
        const pathParts: string[] = [];
        let currentFolder = folders.find(f => f.id === folderId);
        while (currentFolder) {
          pathParts.unshift(currentFolder.name.replace(/[\/\\?%*:|"<>\.\s]+/g, '_'));
          currentFolder = currentFolder.parentId ? folders.find(f => f.id === currentFolder.parentId) : undefined;
        }
        return pathParts.join('/');
      };

      // Put each note's markdown/text into its nested directory in the ZIP for human viewing
      notes.forEach(note => {
        const folderPath = note.folderId ? getFolderPath(note.folderId) : "Note_Senza_Cartella";
        const sanitizedTitle = (note.title || "Senza_Titolo").replace(/[\/\\?%*:|"<>\.\s]+/g, '_');
        const plainText = note.content ? note.content.replace(/<[^>]*>/g, '') : '';
        const txtContent = `${note.title || 'Senza Titolo'}\n\nCreato: ${new Date(note.createdAt).toLocaleString()}\nModificato: ${new Date(note.updatedAt).toLocaleString()}\n\nContenuto:\n${plainText}`;
        
        // Use folder helper in JSZip
        const parentFolder = folderPath ? zip.folder(folderPath) : zip;
        if (parentFolder) {
          parentFolder.file(`${sanitizedTitle}.txt`, txtContent);
        }
      });

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'Note_Android_Backup.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Errore durante l'esportazione dello ZIP:", err);
      alert("Si è verificato un errore durante l'esportazione: " + String(err));
    }
  };

  const handleImportAndroidZip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const zip = new JSZip();
      const content = await zip.loadAsync(file);
      
      const dataJsonFile = content.file("data.json");
      if (!dataJsonFile) {
        alert(settings.language === 'it' 
          ? "Il file ZIP selezionato non contiene il file 'data.json' necessario per il ripristino delle note." 
          : "The selected ZIP file does not contain 'data.json' necessary to import notes."
        );
        return;
      }

      const rawText = await dataJsonFile.async("string");
      const dataPayload = JSON.parse(rawText);
      
      if (!dataPayload || !Array.isArray(dataPayload.folders) || !Array.isArray(dataPayload.notes)) {
        alert(settings.language === 'it'
          ? "Formato file backup 'data.json' non valido."
          : "Invalid data.json backup format."
        );
        return;
      }

      const importedFolders: Folder[] = dataPayload.folders;
      const importedNotes: Note[] = dataPayload.notes;

      // Map folder ids to prevent parentId mismatches or handle duplicates
      const folderIdMapping: { [oldId: string]: string } = {};
      const newFolders = [...folders];

      importedFolders.forEach(impF => {
        // Skip default/all system folder if present in backup to keep app default
        if (impF.id === 'f-all') {
          folderIdMapping[impF.id] = 'f-all';
          return;
        }

        // Find existing folder on active directories matching ID OR name and parentId combination
        const parentIdInCurrentContext = impF.parentId ? (folderIdMapping[impF.parentId] || impF.parentId) : undefined;
        const exists = folders.find(f => f.id === impF.id || (f.name.toLowerCase() === impF.name.toLowerCase() && f.parentId === parentIdInCurrentContext));
        
        if (exists) {
          folderIdMapping[impF.id] = exists.id;
        } else {
          // Add Folder
          const newFolderObj: Folder = {
            id: impF.id,
            name: impF.name,
            pinned: impF.pinned || false,
            parentId: parentIdInCurrentContext,
            description: impF.description,
            showDescription: impF.showDescription ?? true
          };
          newFolders.push(newFolderObj);
          folderIdMapping[impF.id] = impF.id;
        }
      });

      // Import Notes
      const newNotes = [...notes];
      let importedCount = 0;

      importedNotes.forEach(impN => {
        const exists = notes.some(n => n.id === impN.id);
        if (!exists) {
          const finalFolderId = impN.folderId ? (folderIdMapping[impN.folderId] || impN.folderId) : impN.folderId;
          const newNoteObj: Note = {
            ...impN,
            folderId: finalFolderId
          };
          newNotes.push(newNoteObj);
          importedCount++;
        }
      });

      // Update States
      setFolders(newFolders);
      setNotes(newNotes);

      // Save immediately to local storage as safety measure
      localStorage.setItem('android_notes_folders', JSON.stringify(newFolders));
      localStorage.setItem('android_notes_notes', JSON.stringify(newNotes));

      alert(settings.language === 'it'
        ? `Importazione completata con successo! Caricate ${importedCount} nuove note e create le relative cartelle.`
        : `Import completed successfully! Loaded ${importedCount} new notes and recovered folders.`
      );
      
      // Reset input
      e.target.value = '';
    } catch (err) {
      console.error("Errore durante la lettura dello ZIP:", err);
      alert("La lettura del file ZIP è fallita: " + String(err));
    }
  };

  // --- RENDERING HELPERS & DERIVED STATE ---
  const activeNote = notes.find(n => n.id === currentNoteId);

  // Filter notes based on selected folder / search
  const filteredNotesList = notes.filter(note => {
    // Search keyword block
    const matchesSearch = searchQuery.trim() === '' || 
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      note.content.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    // Folder containment block
    if (!selectedFolderId || selectedFolderId === 'f-all') {
      return true; // render everything
    }
    return note.folderId === selectedFolderId;
  });

  const pinnedNotes = filteredNotesList.filter(n => n.pinned);
  const unpinnedNotes = filteredNotesList.filter(n => !n.pinned);

  const renderFullscreenTableCharts = (headers: string[], rows: string[][], primaryColor: string) => {
    const numColumns = headers.length;
    if (numColumns === 0) return null;

    const colDataTypes: { isNumeric: boolean; numericValues: number[]; values: string[] }[] = [];

    for (let c = 0; c < numColumns; c++) {
      let numericValues: number[] = [];
      let values: string[] = [];
      let totalRows = rows.length;

      for (let r = 0; r < totalRows; r++) {
        const rawVal = (rows[r] && rows[r][c] !== undefined) ? rows[r][c] : '';
        values.push(rawVal);
        
        const cleaned = rawVal.replace(/[^\d.-]/g, '');
        const parsed = parseFloat(cleaned);
        
        if (rawVal.trim() !== '' && !isNaN(parsed)) {
          numericValues.push(parsed);
        }
      }

      const isNumeric = totalRows > 0 && (numericValues.length >= Math.ceil(totalRows * 0.5));

      colDataTypes.push({
        isNumeric,
        numericValues,
        values
      });
    }

    // Find Label Column (first text column)
    let labelColIndex = -1;
    for (let c = 0; c < numColumns; c++) {
      if (!colDataTypes[c].isNumeric) {
        labelColIndex = c;
        break;
      }
    }
    if (labelColIndex === -1) {
      labelColIndex = 0;
    }

    // Heuristic ID check
    let isIdCol = false;
    if (colDataTypes[0] && colDataTypes[0].isNumeric) {
      const vals = colDataTypes[0].numericValues;
      if (vals.length > 1 && vals[1] === vals[0] + 1) {
        isIdCol = true;
      }
    }
    if (isIdCol && numColumns > 1 && colDataTypes[1] && !colDataTypes[1].isNumeric) {
      labelColIndex = 1;
    }

    // Find Numeric columns to Graph
    const valueColIndices: number[] = [];
    for (let c = 0; c < numColumns; c++) {
      if (c !== labelColIndex && colDataTypes[c].isNumeric) {
        if (c === 0 && labelColIndex === 1) {
          continue;
        }
        valueColIndices.push(c);
      }
    }

    if (valueColIndices.length === 0) return null;

    const colorsList = [primaryColor, '#10B981', '#3B82F6', '#EF4444', '#8B5CF6', '#F97316'];

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {valueColIndices.map((vColIdx, enumIdx) => {
          const colHeader = headers[vColIdx];
          const colData = colDataTypes[vColIdx];
          const maxVal = Math.max(...colData.numericValues, 1);
          const color = colorsList[enumIdx % colorsList.length];

          return (
            <div key={vColIdx} className="p-4 bg-neutral-950/60 rounded-2xl border border-neutral-800 select-text">
              <div className="border-b border-neutral-800 pb-2 mb-3 flex items-center gap-1.5">
                <span className="text-xs font-bold text-amber-500 uppercase tracking-widest flex items-center gap-1.5">
                  <span className="text-sm">📈</span> {colHeader}
                </span>
              </div>
              <div className="space-y-2.5 py-0.5">
                {rows.map((row, r) => {
                  const rLabel = (row && row[labelColIndex]) ? row[labelColIndex] : `Voce ${r + 1}`;
                  const rawVal = (row && row[vColIdx] !== undefined) ? row[vColIdx] : '';
                  const cleaned = rawVal.replace(/[^\d.-]/g, '');
                  const val = parseFloat(cleaned) || 0;
                  const pct = Math.max(3, Math.min(100, (val / maxVal) * 100));

                  return (
                    <div key={r} className="space-y-1">
                      <div className="flex justify-between text-xs text-neutral-400">
                        <span className="font-semibold truncate max-w-[200px] text-zinc-300 font-sans">${rLabel}</span>
                        <span className="font-mono font-extrabold text-zinc-50">{rawVal}</span>
                      </div>
                      <div className="w-full bg-neutral-800 rounded-full h-2 overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-300" 
                          style={{ width: `${pct}%`, backgroundColor: color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const baseViewportH = visualViewportHeight ? `${visualViewportHeight}px` : '100dvh';
  const isScaledDesktop = isWideLayout && effectiveDesktopScale !== 1;
  const unscaledHeight = isScaledDesktop ? `calc(${baseViewportH} / ${effectiveDesktopScale})` : baseViewportH;

  return (
    <div className={`min-h-screen h-screen h-[100dvh] bg-black text-neutral-100 flex justify-center items-start font-sans overflow-x-auto overflow-y-hidden ${isWideLayout ? 'p-0' : ''}`}>
      
      {/* Full-screen sleek layout - Mobile 480px vs True Desktop Site 1024px Mode with Scale Zoom */}
      <div 
        style={{
          width: isWideLayout ? '1024px' : undefined,
          minWidth: isWideLayout ? '1024px' : undefined,
          maxWidth: isWideLayout ? '1024px' : undefined,
          height: unscaledHeight,
          maxHeight: unscaledHeight,
          transform: isScaledDesktop ? `scale(${effectiveDesktopScale})` : undefined,
          transformOrigin: 'top center',
          marginBottom: isScaledDesktop ? `calc(${baseViewportH} - ${unscaledHeight})` : undefined,
        }}
        className={`w-full ${isWideLayout ? 'min-w-[1024px] max-w-[1024px] border border-neutral-800 shadow-2xl' : 'max-w-[480px]'} md:border-x md:border-neutral-900 md:shadow-2xl h-screen h-[100dvh] overflow-hidden bg-[#000000] flex flex-col relative transition-all duration-300 ease-in-out shrink-0`}
      >
        
        {/* Desktop site mode status & interactive zoom controls banner */}
        {isWideLayout && (
          <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-3 py-1.5 flex items-center justify-between text-xs text-[#E5A93C] font-semibold shrink-0 gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Columns className="w-4 h-4 shrink-0 text-[#E5A93C]" />
              <span className="font-bold">🖥️ Sito Desktop (1024px)</span>
            </div>

            {/* Interactive Zoom Controls */}
            <div className="flex items-center gap-1 bg-black/70 px-2 py-0.5 rounded-lg border border-yellow-500/30">
              <span className="text-[11px] text-neutral-400 font-normal mr-0.5">Zoom:</span>
              
              <button
                onClick={() => {
                  setAutoFitDesktop(false);
                  setDesktopZoomScale(prev => Math.max(0.3, parseFloat((prev - 0.1).toFixed(2))));
                }}
                className="p-1 hover:bg-yellow-500/20 rounded text-yellow-400 cursor-pointer transition active:scale-95"
                title="Riduci Zoom (-)"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>

              <span className="text-xs font-mono font-bold text-yellow-400 px-1 min-w-[38px] text-center">
                {Math.round(effectiveDesktopScale * 100)}%
              </span>

              <button
                onClick={() => {
                  setAutoFitDesktop(false);
                  setDesktopZoomScale(prev => Math.min(2.0, parseFloat((prev + 0.1).toFixed(2))));
                }}
                className="p-1 hover:bg-yellow-500/20 rounded text-yellow-400 cursor-pointer transition active:scale-95"
                title="Aumenta Zoom (+)"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => {
                  setAutoFitDesktop(true);
                  setDesktopZoomScale(1);
                }}
                className={`ml-1 text-[10px] font-bold px-2 py-0.5 rounded transition cursor-pointer ${autoFitDesktop ? 'bg-yellow-500 text-black shadow-sm' : 'bg-neutral-800 text-yellow-400 hover:bg-neutral-700'}`}
                title="Adatta alla larghezza dello schermo"
              >
                {autoFitDesktop ? 'Adattato' : 'Adatta'}
              </button>
            </div>

            <button 
              onClick={() => setIsWideLayout(false)}
              className="text-[11px] hover:text-yellow-400 cursor-pointer font-bold px-2 py-0.5 rounded bg-yellow-500/10 hover:bg-yellow-500/20 text-[#E5A93C] transition border border-yellow-500/20"
            >
              Passa a Mobile (480px)
            </button>
          </div>
        )}
        
        {/* Launch Feedback Toast */}
        {launchFeedbackMessage && (
          <div className="absolute top-16 inset-x-0 mx-auto w-fit z-50 animate-in fade-in slide-in-from-top-4 duration-250">
            <div className="bg-yellow-500 text-black font-bold text-xs px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-2 border border-yellow-400">
              <Home className="w-4 h-4 text-black animate-bounce shrink-0" />
              <span>{launchFeedbackMessage}</span>
            </div>
          </div>
        )}
        
        {/* --- 1. VIEW: FOLDERS LIST (STARTING PAGE) --- */}
        {currentView === 'folders' && (
          <div className="flex-grow h-full max-h-full relative overflow-hidden flex flex-col animate-in fade-in slide-in-from-right-3 duration-200">
            {/* Folder list header */}
            <header className="p-5 pb-3 flex items-center justify-between">
              <h1 className="text-3xl font-bold tracking-tight text-neutral-100 font-sans flex items-center gap-2" id="app-title">
                <span>Note Android</span>
                <span className="text-xs bg-yellow-500/10 text-[#E5A93C] px-2 py-0.5 rounded-full border border-yellow-500/10 font-normal">
                  OS V16
                </span>
                <button
                  id="download-whole-app-trigger"
                  onClick={() => setDownloadModalOpen(true)}
                  className="p-1 rounded-full text-zinc-400 hover:text-yellow-500 hover:bg-neutral-900 transition-colors ml-1 cursor-pointer flex items-center justify-center"
                  title="Scarica l'intera App Offline"
                >
                  <FileDown className="w-5 h-5 text-[#E5A93C]" />
                </button>
              </h1>
              
              <div className="flex items-center gap-2">
                <button 
                  id="wide-layout-toggle-btn-folders"
                  onClick={() => setIsWideLayout(prev => !prev)}
                  className={`p-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${isWideLayout ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40' : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-400'}`}
                  title={isWideLayout ? "Disattiva Sito Desktop (Torna a Vista Mobile 480px)" : "Attiva Modalità Sito Desktop (1024px)"}
                >
                  <Columns className="w-5 h-5 text-[#E5A93C]" />
                  <span className="text-xs font-bold text-[#E5A93C] hidden sm:inline">{isWideLayout ? "Vista Mobile" : "Sito Desktop"}</span>
                </button>

                <button 
                  id="fullscreen-toggle-btn"
                  onClick={toggleFullscreen}
                  className="p-2 rounded-full bg-neutral-900 hover:bg-neutral-800 text-neutral-400 transition cursor-pointer"
                  title={isFullscreen ? "Esci da Schermo Intero" : "Schermo Intero"}
                >
                  {isFullscreen ? <Minimize className="w-5 h-5 text-[#E5A93C]" /> : <Maximize className="w-5 h-5 text-[#E5A93C]" />}
                </button>

                <button 
                  id="settings-nav-btn"
                  onClick={() => setCurrentView('settings')}
                  className="p-2 rounded-full bg-neutral-900 hover:bg-neutral-800 text-neutral-400 transition"
                  title={t.settings}
                >
                  <SettingsIcon className="w-5 h-5 text-[#E5A93C]" />
                </button>
              </div>
            </header>

            {/* Global Search across folders */}
            <div className="px-5 mb-4">
              <div className="relative">
                <input 
                  id="search-notes-input"
                  type="text"
                  placeholder={t.searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full py-2.5 pl-10 pr-4 bg-neutral-900 border border-neutral-800 rounded-xl text-sm text-zinc-100 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500"
                />
                <Search className="w-4.5 h-4.5 text-neutral-500 absolute left-3 top-3" />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-2.5 text-xs text-neutral-400 hover:text-white"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Folder section views */}
            <div className="flex-grow overflow-y-auto px-5 pb-24 space-y-6">
              
              {/* PINNED FOLDERS SECTION */}
              {folders.filter(f => f.pinned && !f.parentId).length > 0 && (
                <div id="pinned-folders-container">
                  <h3 className="text-xs font-bold text-neutral-500 tracking-wider mb-2 uppercase">{t.pinnedFolders}</h3>
                  <div className="grid grid-cols-2 gap-2.5">
                    {folders.filter(f => f.pinned && !f.parentId).map(folder => {
                      const count = getNotesCountRecursively(folder.id);
                      return (
                        <div 
                          key={folder.id}
                          id={`folder-pinned-${folder.id}`}
                          onClick={(e) => handleFolderClick(folder, e)}
                          onMouseDown={(e) => handleStartFolderPress(e, folder)}
                          onMouseUp={(e) => handleEndFolderPress(e, folder)}
                          onMouseLeave={handleCancelFolderPress}
                          onTouchStart={(e) => handleStartFolderPress(e, folder)}
                          onTouchEnd={(e) => handleEndFolderPress(e, folder)}
                          onTouchMove={handleCancelFolderPress}
                          onContextMenu={(e) => e.preventDefault()}
                          className="bg-neutral-900 hover:bg-neutral-850 p-4 rounded-xl border border-neutral-800 cursor-pointer transition flex flex-col justify-between select-none"
                        >
                          <div className="flex justify-between items-start">
                            <span className="p-1.5 rounded-lg bg-yellow-500/10 text-[#E5A93C]">
                              <Pin className="w-4 h-4 fill-current" />
                            </span>
                            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                              <button 
                                onClick={(e) => handleToggleFolderPin(folder.id, e)}
                                className="text-neutral-500 hover:text-white p-1"
                                title={t.unpin}
                              >
                                <Lock className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <div className="mt-4">
                            <h4 className="font-semibold text-neutral-200 text-sm truncate">{folder.name === 'Note Personali' ? 'Note' : folder.name}</h4>
                            {folder.description && (folder.showDescription ?? true) && (
                              <p className="text-[11px] text-zinc-400 font-medium italic mt-0.5 line-clamp-1">{folder.description}</p>
                            )}
                            <span className="text-xs text-neutral-500 mt-1 block">{count} {t.notesCount}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ALL FOLDERS LIST */}
              <div>
                <h3 className="text-xs font-bold text-neutral-500 tracking-wider mb-2 uppercase">{t.otherFolders}</h3>
                <div className="bg-neutral-900 rounded-2xl border border-neutral-800 overflow-hidden divide-y divide-neutral-850" id="folders-grid">
                  
                  {/* "All notes" special folder */}
                  <div 
                    id="folder-item-all"
                    onClick={() => {
                      setSelectedFolderId('f-all');
                      setCurrentView('notes-list');
                    }}
                    className="p-4 flex items-center justify-between hover:bg-neutral-850 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-yellow-500">
                        <Layout className="w-5 h-5 text-[#E5A93C]" />
                      </span>
                      <div>
                        <span className="font-semibold text-neutral-200 text-sm">{t.allNotes}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-neutral-500">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-800">{notes.length}</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>

                  {/* Regular folders nested as a hierarchy tree */}
                  {getFlattenedFolders().filter(({ folder }) => !folder.parentId).map(({ folder, depth }) => {
                    const count = getNotesCountRecursively(folder.id);
                    return (
                      <div 
                        key={folder.id}
                        id={`folder-item-${folder.id}`}
                        onClick={(e) => handleFolderClick(folder, e)}
                        onMouseDown={(e) => handleStartFolderPress(e, folder)}
                        onMouseUp={(e) => handleEndFolderPress(e, folder)}
                        onMouseLeave={handleCancelFolderPress}
                        onTouchStart={(e) => handleStartFolderPress(e, folder)}
                        onTouchEnd={(e) => handleEndFolderPress(e, folder)}
                        onTouchMove={handleCancelFolderPress}
                        onContextMenu={(e) => e.preventDefault()}
                        className="p-4 flex items-center justify-between hover:bg-neutral-850 cursor-pointer transition-colors group select-none"
                        style={{ paddingLeft: `${16 + depth * 16}px` }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {depth > 0 && (
                            <span className="text-zinc-650 font-mono text-xs select-none tracking-tighter mr-1 shrink-0">
                              {"└─".repeat(depth)}
                            </span>
                          )}
                          <span className="text-yellow-500 select-none shrink-0">
                            <svg className="w-5 h-5 text-[#E5A93C]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                            </svg>
                          </span>
                          <div className="flex flex-col min-w-0">
                            <span className="font-medium text-neutral-200 text-sm truncate">{folder.name}</span>
                            {folder.description && (folder.showDescription ?? true) && (
                              <span className="text-neutral-500 text-[10px] truncate max-w-[200px] leading-tight block mt-0.5 italic font-medium">{folder.description}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 text-neutral-500">
                          {/* Folder settings and action tools */}
                          <div className="flex items-center gap-1 opacity-100 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => {
                                setEditingFolderId(folder.id);
                                setFolderNameInput(folder.name);
                                setFolderParentIdInput(folder.parentId || '');
                                setFolderDescriptionInput(folder.description || '');
                                setIsNewFolderModalOpen(true);
                              }}
                              className="p-1 rounded text-neutral-500 hover:text-white hover:bg-neutral-800 transition"
                              title={t.editFolder}
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => handleToggleFolderPin(folder.id, e)}
                              className="p-1 rounded text-neutral-500 hover:text-yellow-500 hover:bg-neutral-800 transition"
                              title={folder.pinned ? t.unpin : t.pin}
                            >
                              <Pin className={`w-3.5 h-3.5 ${folder.pinned ? 'fill-yellow-500 text-yellow-500' : ''}`} />
                            </button>
                            <button
                              onClick={(e) => {
                                handleExportFolderNotes(folder.id);
                              }}
                              className="p-1 rounded text-neutral-500 hover:text-[#E5A93C] hover:bg-neutral-800 transition"
                              title="Backup"
                            >
                              <FileDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => handleDeleteFolder(folder.id, e)}
                              className="p-1 rounded text-neutral-500 hover:text-red-500 hover:bg-neutral-800 transition"
                              title={t.delete}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          
                          <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-850 font-mono text-neutral-400">{count}</span>
                          <ChevronRight className="w-4 h-4 text-neutral-600" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ChatGPT Markdown Import trigger card */}
              <div 
                id="markdown-import-trigger"
                onClick={() => setShowMarkdownImportAlert(true)}
                className="bg-neutral-900/60 p-4 rounded-xl border border-dashed border-neutral-800 hover:border-yellow-500/40 cursor-pointer transition text-center"
              >
                <div className="flex flex-col items-center gap-1.5 text-neutral-400">
                  <Sparkles className="w-6 h-6 text-yellow-500 animate-pulse" />
                  <span className="text-sm font-semibold">{t.convertMdButton}</span>
                  <span className="text-xs text-neutral-500">Incolla Markdown con elenchi, intestazioni e checklists</span>
                </div>
              </div>

              {/* STANDALONE NOTE ANDROID.ZIP BUILDER CARD */}
              <div 
                id="zip-export-trigger"
                onClick={handleExportAndroidZip}
                className="bg-neutral-900/40 p-4 rounded-xl border border-yellow-500/15 hover:border-yellow-500/40 cursor-pointer transition text-center"
              >
                <div className="flex flex-col items-center gap-1.5 font-sans">
                  <div className="p-2 rounded-full bg-yellow-500/10 text-[#E5A93C]">
                    <FileDown className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-bold text-neutral-200">{settings.language === 'it' ? 'Note Android ZIP (Memory Backup)' : 'Note Android ZIP (Memory Backup)'}</span>
                  <p className="text-xs text-neutral-500 px-3">Scarica un unico archivio compresso (.ZIP) contenente la cartella strutturata delle tue note sia in file di testo leggibili sul PC che nel pacchetto dati per un ripristino istantaneo.</p>
                </div>
              </div>

              {/* STANDALONE NOTE ANDROID.ZIP IMPORT CARD */}
              <div 
                id="zip-import-trigger"
                onClick={() => {
                  const input = document.getElementById('notes-zip-import-input');
                  if (input) input.click();
                }}
                className="bg-neutral-900/40 p-4 rounded-xl border border-dashed border-neutral-800 hover:border-yellow-500/30 cursor-pointer transition text-center"
              >
                <div className="flex flex-col items-center gap-1.5 font-sans">
                  <div className="p-2 rounded-full bg-neutral-950 text-neutral-400">
                    <FolderSync className="w-5 h-5 text-yellow-500 animate-pulse" />
                  </div>
                  <span className="text-sm font-bold text-neutral-200">{settings.language === 'it' ? 'Upload ZIP Note Android' : 'Upload ZIP Note Android'}</span>
                  <p className="text-xs text-neutral-500 px-3 font-medium">Carica e ripristina un pacchetto ZIP di backup per importare le note e ricostruire l'intera struttura di cartelle e sottocartelle mancanti.</p>
                  
                  <input 
                    id="notes-zip-import-input"
                    type="file"
                    accept=".zip"
                    onChange={handleImportAndroidZip}
                    className="hidden"
                  />
                </div>
              </div>

            </div>

            {/* New folder action button persistent footer */}
            <div className="absolute bottom-0 inset-x-0 p-4 bg-black/80 backdrop-blur-md border-t border-neutral-900 flex justify-between gap-4">
              <button 
                id="new-folder-btn"
                onClick={() => {
                  setEditingFolderId(null);
                  setFolderNameInput('');
                  setFolderDescriptionInput('');
                  setIsNewFolderModalOpen(true);
                }}
                className="px-4 py-2.5 rounded-xl border border-neutral-800 text-sm font-medium hover:bg-neutral-950 text-neutral-300 flex items-center gap-2 transition"
              >
                <FolderPlus className="w-5 h-5 text-[#E5A93C]" />
                {t.newFolder}
              </button>

              <button 
                id="add-note-btn-folders"
                onClick={handleCreateNote}
                className="px-5 py-2.5 bg-yellow-500 hover:bg-yellow-600 text-neutral-900 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-yellow-500/10 transition"
              >
                <Plus className="w-5 h-5" />
                {t.createNote}
              </button>
            </div>
          </div>
        )}

        {/* --- 2. VIEW: NOTES LIST PAGE --- */}
        {currentView === 'notes-list' && (
          <div className="flex-grow h-full max-h-full relative overflow-hidden flex flex-col animate-in fade-in slide-in-from-right-3 duration-200">
            {/* Header section with folders back-chevron */}
            <header className="p-4 flex items-center justify-between border-b border-neutral-900 bg-neutral-950/40 sticky top-0 backdrop-blur-md z-30">
              <button 
                id="back-to-folders-btn"
                onClick={() => {
                  const currentFolder = folders.find(f => f.id === selectedFolderId);
                  if (currentFolder && currentFolder.parentId) {
                    setSelectedFolderId(currentFolder.parentId);
                  } else {
                    setCurrentView('folders');
                  }
                }}
                className="flex items-center gap-1 text-sm font-medium text-yellow-500 hover:text-yellow-600 transition shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
                {t.folders}
              </button>

              <div className="flex items-center justify-center gap-1 min-w-0 flex-1 px-2">
                <h2 className="text-base font-bold text-neutral-200 truncate max-w-[150px]" id="folder-title">
                  {selectedFolderId === 'f-all' ? t.allNotes : folders.find(f => f.id === selectedFolderId)?.name || 'Note'}
                </h2>
                {selectedFolderId && selectedFolderId !== 'f-all' && (
                  <button
                    onClick={() => {
                      setSettings(prev => ({ ...prev, launchFolderId: selectedFolderId }));
                      setLaunchFeedbackMessage(
                        settings.language === 'it' 
                          ? 'Impostata come cartella di avvio!' 
                          : 'Set as startup folder!'
                      );
                      setTimeout(() => {
                        setLaunchFeedbackMessage(null);
                      }, 2500);
                    }}
                    className="p-1 rounded transition shrink-0 ml-1 cursor-pointer bg-neutral-900/60 hover:bg-neutral-800"
                    title={settings.language === 'it' ? 'Imposta come cartella di avvio predefinita' : 'Set as default launch folder'}
                  >
                    <Home className={`w-3.5 h-3.5 ${settings.launchFolderId === selectedFolderId ? 'text-yellow-500 stroke-[2.5]' : 'text-neutral-500'}`} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button 
                  id="wide-layout-toggle-btn-notes"
                  onClick={() => setIsWideLayout(prev => !prev)}
                  className={`p-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${isWideLayout ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40' : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-400'}`}
                  title={isWideLayout ? "Disattiva Sito Desktop (Torna a Vista Mobile 480px)" : "Attiva Modalità Sito Desktop (1024px)"}
                >
                  <Columns className="w-4 h-4 text-[#E5A93C]" />
                  <span className="text-[11px] font-bold text-[#E5A93C] hidden sm:inline">{isWideLayout ? "Vista Mobile" : "Sito Desktop"}</span>
                </button>

                <button 
                  id="add-note-btn-list"
                  onClick={handleCreateNote}
                  className="p-1.5 bg-yellow-500 hover:bg-yellow-600 text-neutral-900 rounded-lg transition shrink-0"
                  title={t.createNote}
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </header>

            {/* Quick folder search input */}
            <div className="p-4 pb-0">
              <div className="relative">
                <input 
                  id="list-search-input"
                  type="text"
                  placeholder={t.searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full py-2 pl-9 pr-4 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-zinc-200 placeholder-neutral-500 focus:outline-none"
                />
                <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-2.5" />
              </div>
            </div>

            {/* Note items display list view */}
            <div className="flex-grow overflow-y-auto px-4 py-3 pb-24 space-y-4">

              {/* Folder description block if enabled */}
              {selectedFolderId && selectedFolderId !== 'f-all' && (() => {
                const currentFolder = folders.find(f => f.id === selectedFolderId);
                if (currentFolder && currentFolder.description && (currentFolder.showDescription ?? true)) {
                  return (
                    <div id="active-folder-description">
                      <div className="p-3 bg-neutral-900/40 border border-neutral-850/60 rounded-xl text-xs text-neutral-450 italic">
                        {currentFolder.description}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Subfolders navigation and fast creation tray */}
              {selectedFolderId && selectedFolderId !== 'f-all' && (
                <div id="subfolders-tray">
                  <div className="p-3 bg-neutral-900 border border-neutral-850 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-1">
                        <FolderSync className="w-3.5 h-3.5 text-[#E5A93C]" />
                        <span>{settings.language === 'it' ? 'Sottocartelle' : 'Subfolders'}</span>
                      </span>
                      <button
                        onClick={() => {
                          setEditingFolderId(null);
                          setFolderNameInput('');
                          setFolderDescriptionInput('');
                          setFolderParentIdInput(selectedFolderId); // Pre-fill with current folder as parent!
                          setIsNewFolderModalOpen(true);
                        }}
                        className="text-xs text-yellow-500 hover:text-yellow-600 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{settings.language === 'it' ? 'Nuova' : 'New'}</span>
                      </button>
                    </div>
                    
                    {folders.filter(f => f.parentId === selectedFolderId).length === 0 ? (
                      <div className="text-[11px] text-neutral-500 italic">
                        {settings.language === 'it' ? 'Nessuna sottocartella in questa posizione' : 'No subfolders in this location'}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto w-full">
                        {folders.filter(f => f.parentId === selectedFolderId).map(subf => {
                          const subNotesCount = getNotesCountRecursively(subf.id);
                          return (
                            <div
                              key={subf.id}
                              onClick={(e) => handleFolderClick(subf, e)}
                              onMouseDown={(e) => handleStartFolderPress(e, subf)}
                              onMouseUp={(e) => handleEndFolderPress(e, subf)}
                              onMouseLeave={handleCancelFolderPress}
                              onTouchStart={(e) => handleStartFolderPress(e, subf)}
                              onTouchEnd={(e) => handleEndFolderPress(e, subf)}
                              onTouchMove={handleCancelFolderPress}
                              onContextMenu={(e) => e.preventDefault()}
                              className="p-3 bg-neutral-950 border border-neutral-850 hover:border-yellow-500/40 rounded-xl text-neutral-300 flex flex-col justify-between cursor-pointer transition select-none active:scale-[0.98] duration-150"
                            >
                              <div className="flex items-center justify-between gap-2 min-w-0">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="w-2 h-2 rounded-full bg-yellow-500 shrink-0"></span>
                                  <span className="font-bold text-xs text-neutral-200 truncate">{subf.name}</span>
                                </div>
                                <span className="text-[10px] font-mono bg-neutral-900 text-neutral-400 px-2 py-0.5 rounded-full shrink-0">
                                  {subNotesCount} {subNotesCount === 1 ? (settings.language === 'it' ? 'nota' : 'note') : (settings.language === 'it' ? 'note' : 'notes')}
                                </span>
                              </div>
                              {subf.description && (subf.showDescription ?? true) && (
                                <p className="text-[10.5px] text-neutral-450 italic mt-1.5 leading-normal line-clamp-2">
                                  {subf.description}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {filteredNotesList.length === 0 ? (
                <div className="text-center py-12 text-neutral-500 text-sm font-medium" id="notes-empty-state">
                  {t.noNotes}
                </div>
              ) : (
                <>
                  {/* PINNED SECTION */}
                  {pinnedNotes.length > 0 && (
                    <div id="pinned-notes-list">
                      <h4 className="text-[10px] font-bold text-neutral-500 tracking-widest uppercase mb-1.5">{t.pinnedNotes}</h4>
                      <div className="bg-neutral-900 rounded-2xl border border-neutral-800 divide-y divide-neutral-850 overflow-hidden shadow-lg">
                        {pinnedNotes.map(note => {
                          let snippet = '';
                          if (note.customPreview !== undefined && note.customPreview !== "") {
                            snippet = note.customPreview;
                          } else {
                            const isWidgetTable = note.content.includes('data-chart-type="table"') || note.content.includes('<table');
                            const isWidgetChart = note.content.includes('data-widget-type="chart"') && !isWidgetTable;
                            if (isWidgetTable) {
                              snippet = '📊 [Tabella con Grafico] - ' + note.content.replace(/<[^>]*>/g, '').trim().substring(0, 60);
                            } else if (isWidgetChart) {
                              snippet = '📈 [Grafico Statistico] - ' + note.content.replace(/<[^>]*>/g, '').trim().substring(0, 60);
                            } else {
                              snippet = note.content.replace(/<[^>]*>/g, '').trim().substring(0, 75);
                            }
                          }
                          const dateDisplay = new Date(note.updatedAt).toLocaleDateString(settings.language === 'it' ? 'it-IT' : 'en-US', {
                            day: 'numeric', month: 'short'
                          });

                          return (
                            <div 
                              key={note.id}
                              id={`note-item-${note.id}`}
                              onClick={(e) => handleNoteClick(note, e)}
                              onMouseDown={(e) => handleStartPress(e, note)}
                              onMouseUp={(e) => handleEndPress(e, note)}
                              onMouseLeave={handleCancelPress}
                              onTouchStart={(e) => handleStartPress(e, note)}
                              onTouchEnd={(e) => handleEndPress(e, note)}
                              onTouchMove={handleCancelPress}
                              onContextMenu={(e) => e.preventDefault()}
                              className="p-3.5 flex items-start gap-3 hover:bg-neutral-850 select-none active:bg-neutral-800 transition cursor-pointer group"
                            >
                              <div className="flex-grow min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <Pin className="w-3.5 h-3.5 fill-yellow-500 text-yellow-500 shrink-0" />
                                  <span className="font-bold text-sm text-neutral-100 truncate">{note.title || t.unnamedNote}</span>
                                </div>
                                <p className="text-xs text-neutral-400 mt-1 truncate">{snippet || t.emptyNoteBody}</p>
                                <span className="text-[10px] text-neutral-500 mt-1.5 block font-mono">{dateDisplay}</span>
                              </div>
                              
                              {/* Media counter indicator badge */}
                              {note.attachments.length > 0 && (
                                <span className="shrink-0 text-[10px] bg-neutral-800 font-bold text-neutral-400 py-0.5 px-2 rounded">
                                  +{note.attachments.length}
                                </span>
                              )}

                              {/* Interactive operations toolbox on hover / click */}
                              <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                                <button 
                                  onClick={() => handleToggleNotePin(note.id)}
                                  className="p-1 rounded text-neutral-400 hover:text-white"
                                  title={t.unpin}
                                >
                                  <Pin className="w-3.5 h-3.5 fill-current text-yellow-500" />
                                </button>
                                <button 
                                  onClick={(e) => handleDeleteNote(note.id, e)}
                                  className="p-1 rounded text-neutral-500 hover:text-red-500"
                                  title={t.delete}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* UNPINNED SECTION */}
                  {unpinnedNotes.length > 0 && (
                    <div id="unpinned-notes-list">
                      <h4 className="text-[10px] font-bold text-neutral-500 tracking-widest uppercase mb-1.5">{t.recentNotes}</h4>
                      <div className="bg-neutral-900 rounded-2xl border border-neutral-800 divide-y divide-neutral-850 overflow-hidden shadow-sm">
                        {unpinnedNotes.map(note => {
                          let snippet = '';
                          if (note.customPreview !== undefined && note.customPreview !== "") {
                            snippet = note.customPreview;
                          } else {
                            const isWidgetTable = note.content.includes('data-chart-type="table"') || note.content.includes('<table');
                            const isWidgetChart = note.content.includes('data-widget-type="chart"') && !isWidgetTable;
                            if (isWidgetTable) {
                              snippet = '📊 [Tabella con Grafico] - ' + note.content.replace(/<[^>]*>/g, '').trim().substring(0, 60);
                            } else if (isWidgetChart) {
                              snippet = '📈 [Grafico Statistico] - ' + note.content.replace(/<[^>]*>/g, '').trim().substring(0, 60);
                            } else {
                              snippet = note.content.replace(/<[^>]*>/g, '').trim().substring(0, 75);
                            }
                          }
                          const dateDisplay = new Date(note.updatedAt).toLocaleDateString(settings.language === 'it' ? 'it-IT' : 'en-US', {
                            day: 'numeric', month: 'short'
                          });

                          return (
                            <div 
                              key={note.id}
                              id={`note-item-${note.id}`}
                              onClick={(e) => handleNoteClick(note, e)}
                              onMouseDown={(e) => handleStartPress(e, note)}
                              onMouseUp={(e) => handleEndPress(e, note)}
                              onMouseLeave={handleCancelPress}
                              onTouchStart={(e) => handleStartPress(e, note)}
                              onTouchEnd={(e) => handleEndPress(e, note)}
                              onTouchMove={handleCancelPress}
                              onContextMenu={(e) => e.preventDefault()}
                              className="p-3.5 flex items-start justify-between gap-3 hover:bg-[#1a1a1a] select-none active:bg-[#262626] transition cursor-pointer group"
                            >
                              <div className="flex-grow min-w-0">
                                <div className="flex items-center gap-1.5">
                                  {note.passwordLocked && <Lock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />}
                                  <span className="font-semibold text-sm text-neutral-200 truncate">{note.title || t.unnamedNote}</span>
                                </div>
                                <p className="text-xs text-neutral-400 mt-1 truncate">{snippet || t.emptyNoteBody}</p>
                                <span className="text-[10px] text-neutral-500 mt-1.5 block font-mono">{dateDisplay}</span>
                              </div>

                              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                <button 
                                  onClick={() => handleToggleNotePin(note.id)}
                                  className="p-1 rounded text-neutral-500 hover:text-yellow-500 opacity-100 transition"
                                  title={t.pin}
                                >
                                  <Pin className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={(e) => handleExportTextFile(note, e)}
                                  className="p-1 rounded text-neutral-500 hover:text-[#E5A93C]"
                                  title="TXT"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={(e) => handleMoveNoteClick(note.id, e)}
                                  className="p-1 rounded text-neutral-500 hover:text-pink-500"
                                  title={t.move}
                                >
                                  <FolderSync className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={(e) => handleDeleteNote(note.id, e)}
                                  className="p-1 rounded text-neutral-500 hover:text-red-500"
                                  title={t.delete}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}

            </div>
          </div>
        )}

        {/* --- 3. VIEW: NOTE EDITOR (THE NOTE EDIT SCREEN) --- */}
        {/* Occupies complete view. When opened, folders are hidden! ("prima c'è l'inizio poi appena si clicca su crea nota spunta solo la nota.") */}
        {currentView === 'editor' && activeNote && (
          <div className="flex-grow h-full max-h-full relative overflow-hidden flex flex-col bg-neutral-950 animate-in fade-in zoom-in-95 duration-150">
            
            {/* Elegant upper taskbar mimicking iOS top button bar */}
            <header className="p-4 flex items-center justify-between border-b border-neutral-900 bg-neutral-950/80 sticky top-0 backdrop-blur-md z-30">
              <button 
                id="back-to-list-btn"
                onClick={() => {
                  flushEditorChanges();
                  setCurrentNoteId(null);
                  setCurrentView('notes-list');
                }}
                className="flex items-center gap-1 text-sm font-semibold text-yellow-500 hover:text-yellow-600 transition"
              >
                <ArrowLeft className="w-5 h-5" />
                {t.back}
              </button>

              {/* Note features context actions */}
              <div className="flex items-center gap-1.5">
                <button
                  id="note-wide-layout-toggle-btn"
                  onClick={() => setIsWideLayout(prev => !prev)}
                  className={`p-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${isWideLayout ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40' : 'text-neutral-400 hover:bg-neutral-900 hover:text-white'}`}
                  title={isWideLayout ? "Disattiva Sito Desktop (Torna a Vista Mobile 480px)" : "Attiva Modalità Sito Desktop (1024px)"}
                >
                  <Columns className="w-4 h-4 text-[#E5A93C]" />
                  <span className="text-xs font-bold text-[#E5A93C] hidden sm:inline">{isWideLayout ? "Vista Mobile" : "Sito Desktop"}</span>
                </button>

                <button
                  id="note-fullscreen-toggle-btn"
                  onClick={toggleFullscreen}
                  className="p-1.5 rounded-lg text-neutral-400 hover:bg-neutral-900 hover:text-white transition cursor-pointer"
                  title={isFullscreen ? "Esci da Schermo Intero" : "Schermo Intero"}
                >
                  {isFullscreen ? <Minimize className="w-4 h-4 text-[#E5A93C]" /> : <Maximize className="w-4 h-4 text-[#E5A93C]" />}
                </button>

                <button 
                  id="note-pin-toggle-btn"
                  onClick={() => handleToggleNotePin(activeNote.id)}
                  className={`p-1.5 rounded-lg transition-colors ${activeNote.pinned ? 'bg-yellow-500/10 text-yellow-500' : 'text-neutral-400 hover:bg-neutral-900 hover:text-white'}`}
                  title={activeNote.pinned ? t.unpin : t.pin}
                >
                  <Pin className="w-4 h-4" />
                </button>

                <button 
                  id="note-lined-paper-toggle-btn"
                  onClick={(e) => handleToggleNoteLinedPaper(activeNote.id, e)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    (activeNote.linedPaper !== undefined ? activeNote.linedPaper : !!settings.linedPaper) 
                      ? 'bg-yellow-500/20 text-yellow-500 font-bold border border-yellow-500/30' 
                      : 'text-neutral-400 hover:bg-neutral-900 hover:text-white'
                  }`}
                  title={t.toggleLinedPaper}
                >
                  <AlignJustify className="w-4 h-4" />
                </button>

                <button 
                  id="note-lock-toggle-btn"
                  onClick={handleSetPasswordToNote}
                  className={`p-1.5 rounded-lg transition-colors ${activeNote.passwordLocked ? 'bg-red-500/15 text-red-500 font-bold' : 'text-neutral-400 hover:bg-neutral-900 hover:text-white'}`}
                  title={activeNote.passwordLocked ? t.unlock : t.lock}
                >
                  {activeNote.passwordLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                </button>

                <button 
                  id="note-duplicate-btn"
                  onClick={() => handleDuplicateNote(activeNote)}
                  className="p-1.5 rounded-lg text-neutral-400 hover:bg-neutral-900 hover:text-white transition"
                  title={t.duplicate}
                >
                  <Copy className="w-4 h-4" />
                </button>

                <button 
                  id="note-delete-btn"
                  onClick={() => handleDeleteNote(activeNote.id)}
                  className="p-1.5 rounded-lg text-neutral-400 hover:bg-neutral-900 hover:text-red-500 transition"
                  title={t.delete}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </header>

            {/* Note color highlight floating menu */}
            {showColorSelectionMenu && (
              <div 
                id="floating-color-menu"
                className="absolute z-50 bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 flex items-center gap-2 shadow-2xl animate-in fade-in zoom-in-95 duration-100"
                style={{ top: floatingMenuCoord.top, left: Math.max(10, Math.min(window.innerWidth - 270, floatingMenuCoord.left)) }}
              >
                {/* Basic preset buttons using dynamic recentHighlightColors */}
                <div className="flex items-center gap-1">
                  {recentHighlightColors.map(cHex => (
                    <button
                      key={cHex}
                      id={`preset-color-${cHex.replace('#', '')}`}
                      onClick={() => handleApplyColor(cHex)}
                      className="w-5.5 h-5.5 rounded-full border border-white/20 relative"
                      style={{ backgroundColor: cHex }}
                    />
                  ))}
                </div>

                {/* Vertical Separator */}
                <span className="w-[1px] h-5 bg-neutral-800"></span>

                {/* Hex input */}
                <div className="flex items-center gap-1 bg-black/60 px-1.5 py-0.5 rounded border border-neutral-800">
                  <span className="text-[10px] text-zinc-500 font-mono">Hex</span>
                  <input
                    id="hex-color-input"
                    type="text"
                    value={selectionColor}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectionColor(val);
                      if (val.match(/^#[0-9A-Fa-f]{6}$/)) {
                        applyStyle('foreColor', val);
                        setRecentHighlightColors(prev => {
                          const filtered = prev.filter(c => c.toLowerCase() !== val.toLowerCase());
                          const updated = [val, ...filtered].slice(0, 5);
                          localStorage.setItem('android_notes_recent_colors', JSON.stringify(updated));
                          return updated;
                        });
                      }
                    }}
                    className="w-14 text-[10px] font-mono text-zinc-300 bg-transparent outline-none uppercase"
                  />
                </div>

                {/* Fine interactive picker icon */}
                <label 
                  id="fine-picker-label"
                  className="w-5.5 h-5.5 rounded-full border border-neutral-700 flex items-center justify-center cursor-pointer shadow" 
                  style={{ background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' }}
                >
                  <input
                    id="fine-color-picker"
                    type="color"
                    value={selectionColor}
                    onChange={(e) => handleApplyColor(e.target.value)}
                    className="opacity-0 absolute w-0 h-0 invisible"
                  />
                </label>
              </div>
            )}

            {/* Note text editor body container with floating toolbar tracking */}
            <div 
              style={{ paddingBottom: '160px' }}
              className="flex-grow overflow-y-auto p-5 flex flex-col gap-4 relative"
            >
              
              <div className="text-zinc-500 font-mono text-[10px] flex items-center justify-between pb-2 border-b border-neutral-900 select-none">
                <span id="note-created-date">{new Date(activeNote.createdAt).toLocaleString(settings.language === 'it' ? 'it-IT' : 'en-US')}</span>
                <span id="word-counter-badge" className="bg-neutral-900 px-1.5 py-0.5 rounded text-[9px]">
                  {activeNote.content.replace(/<[^>]*>/g, '').trim().split(/\s+/).filter(Boolean).length} parole
                </span>
              </div>

              {/* Rich Contenteditable Canvas */}
              {(() => {
                const isLinedPaperActive = activeNote.linedPaper !== undefined 
                  ? activeNote.linedPaper 
                  : !!settings.linedPaper;
                return (
                  <div 
                    ref={editorRef}
                    id="rich-text-editor-box"
                    contentEditable={!isWidgetEditing}
                    suppressContentEditableWarning={true}
                    style={isLinedPaperActive ? {
                      backgroundImage: 'linear-gradient(transparent 31px, rgba(255, 255, 255, 0.08) 31px)',
                      backgroundSize: '100% 32px',
                      lineHeight: '32px',
                      paddingTop: '6.5px'
                    } : {}}
                    className={`focus:outline-none min-h-[80vh] overflow-x-auto text-neutral-100 ${
                      settings.fontFamily === 'serif' ? 'font-serif' :
                      settings.fontFamily === 'monospace' ? 'font-mono' :
                      settings.fontFamily === 'handwritten' ? 'font-handwritten' : ''
                    } ${
                      settings.fontSize === 'sm' ? 'text-xs' :
                      settings.fontSize === 'md' ? 'text-sm' :
                      settings.fontSize === 'lg' ? 'text-base' :
                      settings.fontSize === 'xl' ? 'text-lg' : ''
                    }`}
                    onInput={handleEditorChange}
                    onClick={handleEditorClick}
                    onMouseUp={handleSelectionDetect}
                    onKeyUp={handleSelectionDetect}
                    onTouchEnd={handleSelectionDetect}
                    placeholder={t.emptyNoteBody}
                  />
                );
              })()}
              {/* Point A Set HUD Toast */}
              {startSelectionBoundary && (
                <div id="point-selection-hud-toast" className="absolute top-2 left-1/2 -translate-x-1/2 z-50 bg-yellow-500/90 backdrop-blur text-neutral-950 text-[11px] font-black px-4 py-2 border border-yellow-400 rounded-full shadow-lg flex items-center gap-2 select-none animate-bounce">
                  <span>📍</span>
                  <span>{settings.language === 'it' ? 'Inizio impostato! Posiziona il cursore e riclicca 📍' : 'Start locked! Place cursor and tap 📍 again'}</span>
                  <button onClick={() => setStartSelectionBoundary(null)} className="ml-1.5 font-black text-[9px] bg-neutral-950 text-yellow-500 px-1.5 py-0.5 rounded hover:bg-neutral-900">X</button>
                </div>
              )}

            </div>

            {/* Bottom styling and media insert tab-bar for Note Editor */}
            <footer 
              style={{ bottom: '0px' }}
              className="absolute inset-x-0 bg-neutral-950/90 backdrop-blur-md border-t border-neutral-900 z-30"
            >
              
              {/* Styling row (H1, H2, Bold, List, Clear) */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-900 overflow-x-auto gap-2">
                
                <div className="flex items-center gap-1 shrink-0">
                  <button 
                    id="format-h1-btn"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyInlineHeadingStyle('H1')}
                    className="p-1.5 rounded hover:bg-neutral-900 text-xs font-black text-neutral-300 cursor-pointer"
                    title="Intestazione 1 (H1)"
                  >
                    H1
                  </button>
                  <button 
                    id="format-h2-btn"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyInlineHeadingStyle('H2')}
                    className="p-1.5 rounded hover:bg-neutral-900 text-xs font-bold text-neutral-400 cursor-pointer"
                    title="Intestazione 2 (H2)"
                  >
                    H2
                  </button>
                  <button 
                    id="format-p-btn"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyInlineHeadingStyle('TXT')}
                    className="p-1.5 rounded hover:bg-neutral-900 text-xs text-neutral-500 cursor-pointer"
                    title="Normale (TXT)"
                  >
                    TXT
                  </button>
                  <button 
                    id="format-mono-btn"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyInlineHeadingStyle('Mono')}
                    className="p-1.5 rounded hover:bg-neutral-900 font-mono text-xs text-emerald-400 cursor-pointer"
                    title="Format Monospace (Mono)"
                  >
                    Mono
                  </button>
                  
                  {/* Point-to-Point selections button next to Mono */}
                  <button 
                    id="format-point-select-btn"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handlePointToPointSelection}
                    className={`p-1.5 rounded text-xs transition duration-150 cursor-pointer ${
                      startSelectionBoundary ? 'bg-yellow-500/25 border border-yellow-500/40 text-yellow-500 animate-pulse font-bold' : 'hover:bg-neutral-900 text-neutral-300'
                    }`}
                    title="Seleziona Punto-Punto"
                  >
                    📍
                  </button>
                  
                  {/* Custom Bullet Symbol Button */}
                  <button 
                    id="format-bullet-symbol-btn"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleInsertBulletSymbol}
                    className="p-1.5 rounded hover:bg-neutral-900 text-xs font-black text-yellow-500 cursor-pointer"
                    title="Inserisci Punto Elenco (• testo)"
                  >
                    • txt
                  </button>

                  {/* Custom Divider Line Button */}
                  <button 
                    id="format-divider-line-btn"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleInsertLineDivider}
                    className="p-1.5 rounded hover:bg-neutral-900 text-xs font-black text-pink-400 cursor-pointer"
                    title="Inserisci Riga Divisore (¯¯¯¯¯¯)"
                  >
                    ¯¯
                  </button>
                </div>

                <div className="w-[1px] h-4 bg-neutral-800 shrink-0"></div>

                <div className="flex items-center gap-1 shrink-0">
                  <button 
                    id="format-bold-btn"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyStyle('bold')}
                    className="p-1.5 rounded hover:bg-neutral-900 text-neutral-300 cursor-pointer"
                    title="Grassetto"
                  >
                    <Bold className="w-4 h-4" />
                  </button>
                  <button 
                    id="format-italic-btn"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyStyle('italic')}
                    className="p-1.5 rounded hover:bg-neutral-900 text-neutral-300 cursor-pointer"
                    title="Corsivo"
                  >
                    <Italic className="w-4 h-4" />
                  </button>
                  <button 
                    id="format-underline-btn"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyStyle('underline')}
                    className="p-1.5 rounded hover:bg-neutral-900 text-neutral-300 cursor-pointer"
                    title="Sottolineato"
                  >
                    <Underline className="w-4 h-4" />
                  </button>
                  <button 
                    id="format-strike-btn"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyStyle('strikeThrough')}
                    className="p-1.5 rounded hover:bg-neutral-900 text-neutral-300 cursor-pointer"
                    title="Barrato"
                  >
                    <Strikethrough className="w-4 h-4" />
                  </button>
                </div>

                <div className="w-[1px] h-4 bg-neutral-800 shrink-0"></div>

                <div className="flex items-center gap-1 shrink-0">
                  <button 
                    id="format-ul-btn"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyStyle('insertUnorderedList')}
                    className="p-1.5 rounded hover:bg-neutral-900 text-neutral-300 cursor-pointer font-sans text-xs"
                  >
                    ul
                  </button>
                  <button 
                    id="format-ol-btn"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyStyle('insertOrderedList')}
                    className="p-1.5 rounded hover:bg-neutral-900 text-neutral-300 cursor-pointer font-sans text-xs"
                  >
                    ol
                  </button>
                  <button 
                    id="format-checklist-btn"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      const checkboxId = 'chk-' + Date.now();
                      const elementHtml = `<div class="flex items-start my-1"><input type="checkbox" id="${checkboxId}" class="w-5 h-5 rounded border-zinc-700 text-yellow-500 mr-2 accent-yellow-500 mt-1" /> &nbsp; <span>Checklist</span></div>`;
                      applyStyle('insertHTML', elementHtml);
                    }}
                    className="p-1.5 rounded hover:bg-neutral-900 text-neutral-300 cursor-pointer"
                    title="Aggiungi Checklist"
                  >
                    <CheckSquare className="w-4 h-4 text-[#E5A93C]" />
                  </button>
                </div>

              </div>

              {/* Media actions grid */}
              <div className="grid grid-cols-6 gap-1 p-3 px-3">
                
                <button
                  id="insert-drawing-btn"
                  onClick={() => setIsDrawingOpen(true)}
                  className="flex flex-col items-center justify-center p-1 rounded-xl hover:bg-neutral-900 text-neutral-400 hover:text-[#E5A93C] transition-colors"
                >
                  <Sparkle className="w-4 h-4 mb-1 text-yellow-500" />
                  <span className="text-[9px] font-semibold">{t.drawingBtn}</span>
                </button>

                <button
                  id="insert-chart-btn"
                  onClick={() => {
                    setEditingChartId(null);
                    setChartTitle('Nuovo Grafico / Tabella');
                    setChartType('bar');
                    setTableMarkdown('');
                    setTableCells([
                      ['', '', ''],
                      ['', '', ''],
                      ['', '', ''],
                    ]);
                    setTableStyles({});
                    setActiveTableStyleTarget({ type: 'cell', rIdx: 0, cIdx: 0 });
                    setChartItems([
                      { label: '', value: 0 },
                      { label: '', value: 0 },
                      { label: '', value: 0 },
                    ]);
                    setChartBuilderOpen(true);
                  }}
                  className="flex flex-col items-center justify-center p-1 rounded-xl hover:bg-neutral-900 text-neutral-400 hover:text-green-500 transition-colors"
                >
                  <Sliders className="w-4 h-4 mb-1 text-green-500" />
                  <span className="text-[9px] font-semibold">{t.chartBtn}</span>
                </button>

                <button
                  id="insert-image-btn"
                  onClick={() => handleAttachLocalFile('image')}
                  className="flex flex-col items-center justify-center p-1 rounded-xl hover:bg-neutral-900 text-neutral-400 hover:text-blue-500 transition-colors"
                >
                  <ImageIcon className="w-4 h-4 mb-1 text-blue-500" />
                  <span className="text-[9px] font-semibold font-sans">Foto</span>
                </button>

                <button
                  id="insert-link-btn"
                  onClick={() => {
                    setLinkUrl('');
                    setLinkLabel('');
                    setLinkShowPreview(false);
                    setLinkBuilderOpen(true);
                  }}
                  className="flex flex-col items-center justify-center p-1 rounded-xl bg-gradient-to-tr from-emerald-500 to-purple-600 text-white hover:opacity-95 active:scale-95 transition-all shadow-md shrink-0 border border-emerald-400/20"
                >
                  <Link className="w-4 h-4 mb-0.5 text-white" />
                  <span className="text-[9px] font-bold font-sans">Link</span>
                </button>

                <button
                  id="insert-audio-btn"
                  onClick={() => handleAttachLocalFile('audio')}
                  className="flex flex-col items-center justify-center p-1 rounded-xl hover:bg-neutral-900 text-neutral-400 hover:text-yellow-600 transition-colors"
                >
                  <Mic className="w-4 h-4 mb-1 text-yellow-600" />
                  <span className="text-[9px] font-semibold font-sans">Audio</span>
                </button>

                <button
                  id="insert-markdown-btn"
                  onClick={() => {
                    setEditorMarkdownString('');
                    setShowEditorMarkdownImport(true);
                  }}
                  className="flex flex-col items-center justify-center p-1 rounded-xl hover:bg-neutral-900 text-neutral-400 hover:text-yellow-500 transition-colors"
                  title="Incolla Markdown"
                >
                  <Sparkles className="w-4 h-4 mb-1 text-yellow-500" />
                  <span className="text-[9px] font-semibold font-sans">MD Paste</span>
                </button>

              </div>

            </footer>

          </div>
        )}

        {/* --- 4. VIEW: SETTINGS SCREEN --- */}
        {currentView === 'settings' && (
          <div className="flex-grow h-full max-h-full relative overflow-hidden flex flex-col bg-neutral-950 animate-in fade-in slide-in-from-right-3 duration-200">
            
            <header className="p-4 flex items-center justify-between border-b border-neutral-900 bg-neutral-950/40 sticky top-0 backdrop-blur-sm z-30">
              <button 
                id="back-from-settings-btn"
                onClick={() => setCurrentView('folders')}
                className="flex items-center gap-1 text-sm font-semibold text-yellow-500 hover:text-yellow-600 transition"
              >
                <ArrowLeft className="w-5 h-5" />
                {t.folders}
              </button>

              <h2 className="text-base font-extrabold text-neutral-100">{t.settings}</h2>
              <div className="w-5"></div>
            </header>

            {/* Scrollable setting controls */}
            <div className="flex-grow overflow-y-auto p-5 pb-24 space-y-6">
              
              {/* Language Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest block">{t.language}</label>
                <div className="grid grid-cols-2 gap-2 bg-neutral-900 p-1.5 rounded-xl border border-neutral-800">
                  <button
                    id="lang-it-btn"
                    onClick={() => setSettings(prev => ({ ...prev, language: 'it' }))}
                    className={`py-2 text-xs rounded-lg font-bold flex items-center justify-center gap-1.5 transition ${settings.language === 'it' ? 'bg-[#000000] border border-neutral-800 text-yellow-500' : 'text-neutral-400 hover:text-neutral-200'}`}
                  >
                    🇮🇹 Italiano
                  </button>
                  <button
                    id="lang-en-btn"
                    onClick={() => setSettings(prev => ({ ...prev, language: 'en' }))}
                    className={`py-2 text-xs rounded-lg font-bold flex items-center justify-center gap-1.5 transition ${settings.language === 'en' ? 'bg-[#000000] border border-neutral-800 text-yellow-500' : 'text-neutral-400 hover:text-neutral-200'}`}
                  >
                    🇺🇸 English
                  </button>
                </div>
              </div>

              {/* Primary Color selection theme */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest block">{t.primaryColor}</label>
                <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800 space-y-4">
                  <div className="flex flex-wrap items-center gap-2.5">
                    {COLOR_PRESETS.map((colorHex) => (
                      <button
                        key={colorHex}
                        id={`app-primary-${colorHex.replace('#', '')}`}
                        onClick={() => handleApplyPrimaryColor(colorHex)}
                        className={`w-8 h-8 rounded-full border-2 transition-transform ${settings.primaryColor === colorHex ? 'border-yellow-500 scale-110 shadow' : 'border-transparent'}`}
                        style={{ backgroundColor: colorHex }}
                      />
                    ))}

                    {/* Native browser color picker button */}
                    <label 
                      id="custom-primary-color-picker-label"
                      className="w-8 h-8 rounded-full border-2 border-neutral-700 flex items-center justify-center cursor-pointer shadow hover:scale-105 transition-transform relative" 
                      style={{ background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' }}
                      title="Scegli colore dal browser"
                    >
                      <input
                        id="custom-primary-color-picker"
                        type="color"
                        value={settings.primaryColor.startsWith('#') && settings.primaryColor.length === 7 ? settings.primaryColor : '#E5A93C'}
                        onChange={(e) => handleApplyPrimaryColor(e.target.value)}
                        className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                      />
                    </label>
                  </div>

                  {/* Recent primary colors row */}
                  {recentPrimaryColors.length > 0 && (
                    <div className="space-y-1.5 pt-3 border-t border-neutral-800/60">
                      <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">Colori Recenti:</span>
                      <div className="flex flex-wrap items-center gap-2">
                        {recentPrimaryColors.map((rColor, idx) => (
                          <button
                            key={`${rColor}-${idx}`}
                            id={`recent-primary-${rColor.replace('#', '')}-${idx}`}
                            onClick={() => handleApplyPrimaryColor(rColor)}
                            className={`w-7 h-7 rounded-full border-2 transition-transform relative flex items-center justify-center ${settings.primaryColor === rColor ? 'border-yellow-500 scale-110 shadow' : 'border-transparent'}`}
                            style={{ backgroundColor: rColor }}
                            title={`Recente ${idx + 1}`}
                          >
                            {settings.primaryColor === rColor && (
                              <Check className="w-3.5 h-3.5 text-black mix-blend-difference" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 bg-black/60 px-3 py-2 rounded-lg border border-neutral-800">
                    <span className="text-xs text-neutral-400">Custom HEX:</span>
                    <input 
                      id="custom-primary-color-hex"
                      type="text" 
                      value={settings.primaryColor} 
                      onChange={(e) => {
                        const val = e.target.value;
                        setSettings(prev => ({ ...prev, primaryColor: val }));
                        if (val.match(/^#[0-9A-Fa-f]{6}$/) || val.match(/^#[0-9A-Fa-f]{3}$/)) {
                          handleApplyPrimaryColor(val);
                        }
                      }}
                      className="bg-transparent text-sm font-mono uppercase outline-none flex-grow"
                      style={{ color: settings.primaryColor }}
                    />
                  </div>
                </div>
              </div>

              {/* Editor Font size setting */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest block">{t.fontSize}</label>
                <div className="grid grid-cols-4 gap-1.5 bg-neutral-900 p-1 rounded-xl border border-neutral-800 font-mono">
                  {(['sm', 'md', 'lg', 'xl'] as const).map((size) => (
                    <button
                      key={size}
                      id={`font-size-${size}`}
                      onClick={() => setSettings(prev => ({ ...prev, fontSize: size }))}
                      className={`py-2 text-[11px] rounded-lg font-bold transition uppercase ${settings.fontSize === size ? 'bg-[#000000] border border-neutral-800 text-yellow-500' : 'text-neutral-400 hover:text-neutral-200'}`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Family style setting */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest block">{t.fontFamily}</label>
                <div className="flex flex-col gap-1.5 bg-neutral-900 p-1.5 rounded-xl border border-neutral-800">
                  <button
                    id="font-family-system"
                    onClick={() => setSettings(prev => ({ ...prev, fontFamily: 'system' }))}
                    className={`w-full px-3 py-2.5 rounded-lg text-left text-xs flex justify-between font-bold transition ${settings.fontFamily === 'system' ? 'bg-[#000000] border border-neutral-800 text-yellow-500' : 'text-neutral-400'}`}
                  >
                    <span>{t.fontStyleSystem}</span>
                    <span className="font-sans">Abc</span>
                  </button>
                  <button
                    id="font-family-serif"
                    onClick={() => setSettings(prev => ({ ...prev, fontFamily: 'serif' }))}
                    className={`w-full px-3 py-2.5 rounded-lg text-left text-xs flex justify-between font-bold transition ${settings.fontFamily === 'serif' ? 'bg-[#000000] border border-neutral-800 text-yellow-500' : 'text-neutral-400'}`}
                  >
                    <span>{t.fontStyleSerif}</span>
                    <span className="font-serif">Abc</span>
                  </button>
                  <button
                    id="font-family-monospace"
                    onClick={() => setSettings(prev => ({ ...prev, fontFamily: 'monospace' }))}
                    className={`w-full px-3 py-2.5 rounded-lg text-left text-xs flex justify-between font-bold transition ${settings.fontFamily === 'monospace' ? 'bg-[#000000] border border-neutral-800 text-yellow-500' : 'text-neutral-400'}`}
                  >
                    <span>{t.fontStyleMono}</span>
                    <span className="font-mono">Abc</span>
                  </button>
                  <button
                    id="font-family-handwritten"
                    onClick={() => setSettings(prev => ({ ...prev, fontFamily: 'handwritten' }))}
                    className={`w-full px-3 py-2.5 rounded-lg text-left text-xs flex justify-between font-bold transition ${settings.fontFamily === 'handwritten' ? 'bg-[#000000] border border-neutral-800 text-yellow-500' : 'text-neutral-400'}`}
                  >
                    <span>{t.fontStyleHand}</span>
                    <span className="font-serif italic text-sm">Abc</span>
                  </button>
                </div>
              </div>

              {/* Startup Screen select folder */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest block">{t.defaultFolder}</label>
                <select
                  id="launch-folder-selector"
                  value={settings.launchFolderId}
                  onChange={(e) => setSettings(prev => ({ ...prev, launchFolderId: e.target.value }))}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl py-2.5 px-3 text-xs text-neutral-200 outline-none focus:ring-1 focus:ring-yellow-500"
                >
                  <option value="folders">Home (Folders Grid)</option>
                  <option value="f-all">{t.allNotes}</option>
                  {folders.filter(f => !f.isSystem).map(fol => (
                    <option key={fol.id} value={fol.id}>{fol.name}</option>
                  ))}
                </select>
              </div>

              {/* Lined Paper Setting */}
              <div className="space-y-2 border-t border-neutral-900 pt-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">{t.linedPaperSetting}</span>
                  <label id="toggle-lined-paper-setting-lbl" className="inline-flex items-center cursor-pointer select-none">
                    <input 
                      id="toggle-lined-paper-setting-input"
                      type="checkbox" 
                      className="sr-only peer"
                      checked={!!settings.linedPaper}
                      onChange={(e) => setSettings(prev => ({ ...prev, linedPaper: e.target.checked }))}
                    />
                    <div className="relative w-9 h-5 bg-neutral-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-neutral-400 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-yellow-500 peer-checked:after:bg-neutral-950 peer-checked:after:border-neutral-950"></div>
                  </label>
                </div>
              </div>

              {/* Edit Android Notes Link Button */}
              <div className="space-y-2 border-t border-neutral-900 pt-4">
                <a
                  id="edit-android-notes-link"
                  href="https://ai.studio/apps/850983da-a23f-4668-a64b-7bd90f1d5580"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-4 rounded-xl border border-neutral-800 hover:border-yellow-500/35 text-xs font-bold text-yellow-500 bg-neutral-950 hover:bg-[#121212] transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] duration-150 shadow-sm"
                >
                  <Edit className="w-4 h-4 text-[#E5A93C]" />
                  <span>modifica Note android</span>
                </a>
              </div>

            </div>
          </div>
        )}

        {/* --- MODAL DIALOGS SYSTEMS --- */}

        {/* Download App Offline Modal */}
        {downloadModalOpen && (
          <div 
            id="download-app-modal-overlay" 
            className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <div 
              id="download-app-modal-body" 
              className="bg-neutral-950 border border-neutral-800 rounded-3xl p-6 w-full max-w-sm flex flex-col gap-5 text-center animate-in fade-in zoom-in-95 duration-150"
            >
              <div>
                <div className="w-12 h-12 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-3 border border-yellow-500/20">
                  <FileDown className="w-6 h-6 text-[#E5A93C] animate-bounce" />
                </div>
                <h3 className="text-lg font-bold text-neutral-100">Esporta Applicazione</h3>
                <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">
                  Scarica l'intera app pronta all'uso offline, completa di tutte le ultime modifiche apportate al codice.
                </p>
              </div>

              {isPackingApp ? (
                <div className="py-6 flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="w-8 h-8 text-[#E5A93C] animate-spin" />
                  <span className="text-xs text-neutral-300 animate-pulse font-medium">
                    Compilazione e compressione in corso...
                  </span>
                  <span className="text-[10px] text-neutral-500 italic">
                    (Vite sta ricompilando i sorgenti aggiornati)
                  </span>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  <button
                    onClick={() => handleDownloadApp('html')}
                    className="w-full text-left p-3 rounded-2xl bg-neutral-900 border border-neutral-850 hover:border-yellow-500/30 hover:bg-neutral-850 transition flex items-center gap-3 cursor-pointer group"
                  >
                    <div className="p-2 rounded-lg bg-yellow-500/15 text-[#E5A93C] group-hover:bg-yellow-500/25 transition">
                      <span className="text-[13px] font-black font-mono">HTML</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-bold block text-neutral-200">File HTML Singolo (.html)</span>
                      <span className="text-[10px] text-neutral-500 block">Tutto in un singolo file. Funziona su PC e smartphone toccandolo due volte.</span>
                    </div>
                  </button>

                  <button
                    onClick={() => handleDownloadApp('zip')}
                    className="w-full text-left p-3 rounded-2xl bg-neutral-900 border border-neutral-850 hover:border-yellow-500/30 hover:bg-neutral-850 transition flex items-center gap-3 cursor-pointer group"
                  >
                    <div className="p-2 rounded-lg bg-orange-500/15 text-orange-400 group-hover:bg-orange-500/25 transition">
                      <span className="text-[13px] font-black font-mono">ZIP</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-bold block text-neutral-200">Cartella con Assets (.zip)</span>
                      <span className="text-[10px] text-neutral-500 block">La cartella "dist" compilata pronta per hosting o server locale statico.</span>
                    </div>
                  </button>

                  <button
                    onClick={() => handleDownloadApp('src')}
                    className="w-full text-left p-3 rounded-2xl bg-neutral-900 border border-neutral-850 hover:border-emerald-500/30 hover:bg-neutral-850 transition flex items-center gap-3 cursor-pointer group"
                  >
                    <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-450 group-hover:bg-emerald-500/25 transition">
                      <span className="text-[13px] font-black font-mono">SRC</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-bold block text-neutral-100">Sorgenti Interi del Progetto</span>
                      <span className="text-[10px] text-neutral-500 block">Archivio con tutti i file di codice per aprirlo in VS Code locale.</span>
                    </div>
                  </button>
                </div>
              )}

              <div className="flex gap-2.5 mt-2">
                <button
                  id="close-download-dialog-btn"
                  onClick={() => setDownloadModalOpen(false)}
                  disabled={isPackingApp}
                  className="flex-1 py-2.5 rounded-xl border border-neutral-850 bg-black hover:bg-neutral-900 text-neutral-300 text-xs font-bold cursor-pointer disabled:opacity-50 transition"
                >
                  Chiudi
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Folder Popup Modal */}
        {isNewFolderModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm" id="folder-creation-modal">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-sm p-5 space-y-4 animate-in fade-in zoom-in-95 duration-100">
              <h3 className="font-bold text-base text-neutral-100">{editingFolderId ? t.editFolder : t.newFolder}</h3>
              <div className="space-y-1.5">
                <label className="text-xs text-neutral-450">{t.folderName}</label>
                <input 
                  id="folder-name-modal-input"
                  type="text" 
                  value={folderNameInput}
                  onChange={(e) => setFolderNameInput(e.target.value)}
                  className="w-full py-2 px-3 bg-black border border-neutral-800 rounded-lg text-sm text-neutral-200 focus:outline-none"
                  placeholder="e.g. Spesa, Università"
                  autoFocus
                />
              </div>

              {/* Subfolder parent selection support */}
              <div className="space-y-1.5">
                <label className="text-xs text-neutral-450">
                  {settings.language === 'it' ? 'Cartella principale (opzionale)' : 'Parent folder (optional)'}
                </label>
                <select
                  id="folder-parent-modal-select"
                  value={folderParentIdInput}
                  onChange={(e) => setFolderParentIdInput(e.target.value)}
                  className="w-full py-2 px-3 bg-black border border-neutral-800 rounded-lg text-sm text-neutral-200 focus:outline-none"
                >
                  <option value="">
                    {settings.language === 'it' ? 'Nessuna (Cartella di primo livello)' : 'None (Top-level folder)'}
                  </option>
                  {folders.filter(f => {
                    if (f.isSystem) return false;
                    if (editingFolderId) {
                      if (f.id === editingFolderId) return false;
                      // Guard loops (no circular ancestor trees)
                      let temp: Folder | undefined = f;
                      while (temp) {
                        if (temp.parentId === editingFolderId) return false;
                        temp = folders.find(p => p.id === temp?.parentId);
                      }
                    }
                    return true;
                  }).map(f => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Folder description field */}
              <div className="space-y-1.5">
                <label className="text-xs text-neutral-450">
                  {settings.language === 'it' ? 'Descrizione cartella (opzionale)' : 'Folder description (optional)'}
                </label>
                <textarea
                  id="folder-description-modal-input"
                  rows={2}
                  value={folderDescriptionInput}
                  onChange={(e) => setFolderDescriptionInput(e.target.value)}
                  className="w-full py-2 px-3 bg-black border border-neutral-800 rounded-lg text-sm text-neutral-200 focus:outline-none resize-none placeholder-zinc-700"
                  placeholder={settings.language === 'it' ? 'Aggiungi scopi o appunti della cartella...' : 'Enter a description...'}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  id="folder-modal-cancel-btn"
                  onClick={() => setIsNewFolderModalOpen(false)}
                  className="flex-1 py-2 rounded-lg text-xs font-medium text-neutral-400 bg-neutral-950 border border-neutral-800 hover:text-white cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button 
                  id="folder-modal-save-btn"
                  onClick={handleAddNewFolder}
                  className="flex-1 py-2 rounded-lg text-xs font-bold bg-yellow-500 hover:bg-yellow-600 text-black cursor-pointer"
                >
                  {t.save}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal per modificare la descrizione della cartella */}
        {isDescriptionEditOpen && (
          <div className="fixed inset-0 z-55 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm" id="folder-description-edit-modal">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-sm p-4.5 space-y-4 animate-in fade-in zoom-in-95 duration-100">
              <h3 className="font-bold text-base text-neutral-100">
                {settings.language === 'it' ? 'Modifica Descrizione' : 'Edit Description'}
              </h3>
              <div className="space-y-1.5">
                <label className="text-xs text-neutral-450 font-medium">
                  {settings.language === 'it' ? 'Descrizione della cartella' : 'Folder description'}
                </label>
                <textarea
                  id="folder-desc-textarea-input"
                  rows={3}
                  value={folderDescriptionInput}
                  onChange={(e) => setFolderDescriptionInput(e.target.value)}
                  className="w-full py-2 px-3 bg-black border border-neutral-800 rounded-lg text-sm text-neutral-200 focus:outline-none resize-none placeholder-zinc-600"
                  placeholder={settings.language === 'it' ? 'Aggiungi dettagli o scopi per questa cartella...' : 'Enter purpose or details for this folder...'}
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <div className="flex gap-2">
                  <button 
                    id="folder-desc-cancel-btn"
                    onClick={() => {
                      setIsDescriptionEditOpen(false);
                      setEditingFolderId(null);
                    }}
                    className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-neutral-450 bg-neutral-950 border border-neutral-850 hover:text-white cursor-pointer transition active:scale-95"
                  >
                    {t.cancel}
                  </button>
                  <button 
                    id="folder-desc-save-btn"
                    onClick={() => {
                      if (editingFolderId) {
                        setFolders(prev => prev.map(f => f.id === editingFolderId ? { 
                          ...f, 
                          description: folderDescriptionInput.trim() || undefined 
                        } : f));
                      }
                      setIsDescriptionEditOpen(false);
                      setEditingFolderId(null);
                    }}
                    className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-yellow-500 hover:bg-yellow-600 text-black cursor-pointer transition active:scale-95"
                  >
                    {t.save}
                  </button>
                </div>
                {editingFolderId && folders.find(f => f.id === editingFolderId)?.description && (
                  <button
                    id="folder-desc-delete-btn"
                    onClick={() => {
                      if (editingFolderId) {
                        setFolders(prev => prev.map(f => f.id === editingFolderId ? { 
                          ...f, 
                          description: undefined 
                        } : f));
                        setFolderDescriptionInput('');
                      }
                      setIsDescriptionEditOpen(false);
                      setEditingFolderId(null);
                    }}
                    className="w-full py-1.5 rounded-lg text-xs font-semibold text-red-400 bg-red-950/20 hover:bg-red-950/40 border border-red-500/20 hover:text-red-300 transition cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{settings.language === 'it' ? 'Elimina Descrizione' : 'Delete Description'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Markdown Manual Paste Modal */}
        {showMarkdownImportAlert && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm" id="markdown-import-modal">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-sm p-5 space-y-3.5 animate-in fade-in zoom-in-95 duration-120">
              <h3 className="font-bold text-base text-yellow-500 flex items-center gap-1.5">
                <Sparkles className="w-5 h-5 text-[#E5A93C]" />
                {t.convertMdButton}
              </h3>
              <p className="text-xs text-neutral-400">Riconosce intestazioni, checklist (- [ ] o - [x]), elenchi e grassetti, formattandoli automaticamente in blocchi interattivi compatibili con i Note Android.</p>
              
              <textarea
                id="markdown-paste-textarea"
                value={pastedMarkdownString}
                onChange={(e) => setPastedMarkdownString(e.target.value)}
                placeholder="# Intestazione&#10;- [ ] Checklist spuntabile&#10;**Testo in Grassetto**&#10;- Elenco puntato"
                className="w-full h-36 bg-black border border-neutral-800 rounded-lg p-3 text-xs font-mono text-zinc-100 placeholder-neutral-605 outline-none resize-none"
              />

              <div className="flex gap-2">
                <button 
                  id="markdown-modal-cancel"
                  onClick={() => setShowMarkdownImportAlert(false)}
                  className="flex-1 py-1.5 bg-neutral-950 text-neutral-405 border border-neutral-850 hover:text-white text-xs rounded-lg"
                >
                  {t.cancel}
                </button>
                <button 
                  id="markdown-modal-submit"
                  onClick={handlePasteMarkdownManual}
                  disabled={!pastedMarkdownString.trim()}
                  className="flex-1 py-1.5 bg-yellow-500 text-neutral-950 font-bold hover:bg-yellow-600 text-xs rounded-lg disabled:opacity-40"
                >
                  Importa Nota
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Editor Markdown Paste Modal */}
        {showEditorMarkdownImport && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm" id="editor-markdown-import-modal">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-sm p-5 space-y-3.5 animate-in fade-in zoom-in-95 duration-120">
              <h3 className="font-bold text-base text-yellow-500 flex items-center gap-1.5">
                <Sparkles className="w-5 h-5 text-[#E5A93C]" />
                {settings.language === 'it' ? 'Incolla codice Markdown' : 'Paste Markdown Code'}
              </h3>
              <p className="text-xs text-neutral-400">
                {settings.language === 'it' 
                  ? 'Il testo verrà formattato all\'istante e inserito nella nota alla posizione corrente del cursore.' 
                  : 'The text will be instantly formatted and inserted into your note at the current cursor position.'}
              </p>
              
              <textarea
                id="editor-markdown-paste-textarea"
                value={editorMarkdownString}
                onChange={(e) => setEditorMarkdownString(e.target.value)}
                placeholder="# Intestazione&#10;- [ ] Checklist spuntabile&#10;**Testo in Grassetto**&#10;- Elenco puntato"
                className="w-full h-36 bg-black border border-neutral-800 rounded-lg p-3 text-xs font-mono text-zinc-100 placeholder-neutral-605 outline-none resize-none"
                autoFocus
              />

              <div className="flex gap-2">
                <button 
                  id="editor-markdown-modal-cancel"
                  onClick={() => setShowEditorMarkdownImport(false)}
                  className="flex-1 py-1.5 bg-neutral-950 text-neutral-405 border border-neutral-850 hover:text-white text-xs rounded-lg cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button 
                  id="editor-markdown-modal-submit"
                  onClick={handlePasteMarkdownInEditor}
                  disabled={!editorMarkdownString.trim()}
                  className="flex-1 py-1.5 bg-yellow-500 text-neutral-950 font-bold hover:bg-yellow-600 text-xs rounded-lg disabled:opacity-40 cursor-pointer"
                >
                  {settings.language === 'it' ? 'Inserisci' : 'Insert'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Note password Unlock Prompt modal */}
        {unlockNoteIdTarget && (
          <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-md" id="unlock-password-modal">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-xs p-5 space-y-4 text-center">
              <div className="mx-auto w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-2">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-neutral-100">{t.passwordRequired}</h3>
                <p className="text-[11px] text-neutral-500 mt-1">Questa nota contiene allegati e testi schermati da password.</p>
              </div>

              <input 
                id="unlock-password-input"
                type="password"
                value={unlockPasswordInput}
                onChange={(e) => setUnlockPasswordInput(e.target.value)}
                placeholder={t.enterPassword}
                className="w-full text-center py-2 px-3 bg-black border border-neutral-800 rounded-lg text-xs"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleVerifyUnlockPassword();
                }}
              />

              <div className="flex gap-2 pt-1">
                <button 
                  id="unlock-modal-cancel"
                  onClick={() => setUnlockNoteIdTarget(null)}
                  className="flex-1 py-1.5 rounded-lg text-xs text-neutral-400 bg-neutral-950 border border-neutral-800 hover:text-white"
                >
                  {t.cancel}
                </button>
                <button 
                  id="unlock-modal-submit"
                  onClick={handleVerifyUnlockPassword}
                  className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-yellow-500 text-black hover:bg-yellow-600"
                >
                  Sblocca
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Folder selection modal to Move Note */}
        {moveNoteFolderModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm" id="move-note-folder-modal">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-xs p-5 space-y-3.5 animate-in fade-in zoom-in-95 duration-100">
              <h3 className="font-bold text-sm text-white">{t.moveNoteTo}</h3>
              <div className="max-h-56 overflow-y-auto divide-y divide-neutral-850 border border-neutral-800 rounded-xl overflow-hidden">
                {folders.filter(f => !f.isSystem).length === 0 ? (
                  <div className="p-4 text-center text-xs text-neutral-500 italic">
                    Nessuna cartella disponibile
                  </div>
                ) : (
                  folders.filter(f => !f.isSystem).map(fol => (
                    <div 
                      key={fol.id}
                      className="flex items-center justify-between p-2.5 bg-neutral-950 hover:bg-neutral-900 transition group"
                    >
                      <button 
                        id={`move-target-folder-${fol.id}`}
                        onClick={() => handleExecuteMoveNote(fol.id)}
                        className="flex-1 text-left text-xs text-neutral-300 font-medium truncate flex items-center gap-2"
                      >
                        <span className="shrink-0">📂</span>
                        <span className="truncate">{fol.name}</span>
                      </button>
                      <button
                        onClick={(e) => handleDeleteFolder(fol.id, e)}
                        className="p-1.5 text-neutral-500 hover:text-red-500 hover:bg-neutral-800 rounded-lg transition shrink-0 ml-1.5 cursor-pointer"
                        title={t.delete}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <button 
                id="move-modal-cancel"
                onClick={() => {
                  setMoveNoteFolderModalOpen(false);
                  setMovingNoteId(null);
                }}
                className="w-full py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-750 text-neutral-400 text-xs font-semibold"
              >
                {t.cancel}
              </button>
            </div>
          </div>
        )}

        {/* Dynamic Interactive Chart Builder Modal */}
        {chartBuilderOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm" id="chart-builder-modal">
            <div className={`bg-neutral-900 border border-neutral-800 rounded-2xl w-full p-5 space-y-4 max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-120 transition-all ${chartType === 'table' ? 'max-w-xl' : 'max-w-sm'}`}>
              <h3 className="font-bold text-base text-zinc-100 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-green-500" />
                {t.chartBuilder}
              </h3>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 font-bold uppercase block">Titolo Grafico / Tabella</label>
                  <input 
                    id="chart-title-input"
                    type="text" 
                    value={chartTitle}
                    onChange={(e) => setChartTitle(e.target.value)}
                    className="w-full bg-black border border-neutral-800 py-1.5 px-3 rounded-lg text-xs"
                    placeholder="e.g. Produttività personale"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 font-bold uppercase block">{t.chartTypeLabel}</label>
                  <div className="grid grid-cols-4 gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-850">
                    <button
                      id="chart-type-bar"
                      onClick={() => setChartType('bar')}
                      className={`py-1 rounded text-[9px] font-bold transition ${chartType === 'bar' ? 'bg-neutral-800 text-yellow-500' : 'text-neutral-400'}`}
                    >
                      Barre
                    </button>
                    <button
                      id="chart-type-line"
                      onClick={() => setChartType('line')}
                      className={`py-1 rounded text-[9px] font-bold transition ${chartType === 'line' ? 'bg-neutral-800 text-yellow-500' : 'text-neutral-400'}`}
                    >
                      Linee
                    </button>
                    <button
                      id="chart-type-pie"
                      onClick={() => setChartType('pie')}
                      className={`py-1 rounded text-[9px] font-bold transition ${chartType === 'pie' ? 'bg-neutral-800 text-yellow-500' : 'text-neutral-400'}`}
                    >
                      Torta
                    </button>
                    <button
                      id="chart-type-table"
                      onClick={() => setChartType('table')}
                      className={`py-1 rounded text-[9px] font-bold transition ${chartType === 'table' ? 'bg-neutral-800 text-yellow-500' : 'text-neutral-400'}`}
                    >
                      Tabella
                    </button>
                  </div>
                </div>

                {chartType === 'table' ? (
                  <div className="space-y-4 pt-1">
                    {/* Paste Markdown Input */}
                    <div className="space-y-1 bg-black/40 p-2.5 rounded-xl border border-neutral-800">
                      <label className="text-[10px] text-zinc-400 font-bold uppercase block flex justify-between select-none">
                        <span>Incolla Markdown (da ChatGPT)</span>
                        <span className="text-[9px] text-yellow-500 font-normal">Sincronizzazione automatica</span>
                      </label>
                      <textarea
                        id="markdown-table-paste"
                        className="w-full bg-black border border-neutral-800 py-1.5 px-2.5 rounded text-xs font-mono h-16 resize-none placeholder:text-neutral-600 focus:outline-none focus:border-neutral-700 text-zinc-300"
                        placeholder={`| Beneficio | Descrizione |\n|---|---|\n| Idratazione | Mantiene i liquidi |`}
                        value={tableMarkdown}
                        onChange={(e) => {
                          const val = e.target.value;
                          setTableMarkdown(val);
                          const parsed = parseMarkdownTable(val);
                          if (parsed) {
                            setTableCells(parsed);
                          }
                        }}
                      />
                    </div>

                    {/* Table Grid Editor */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase">Editor Tabella</span>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            id="table-add-col-btn"
                            onClick={() => {
                              setTableCells(prev => {
                                const colsCount = prev[0]?.length || 3;
                                return prev.map(row => [...row, '']);
                              });
                            }}
                            className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-750 text-[9px] font-bold text-zinc-300"
                          >
                            + Colonna
                          </button>
                          <button
                            type="button"
                            id="table-add-row-btn"
                            onClick={() => {
                              setTableCells(prev => {
                                const colsCount = prev[0]?.length || 3;
                                return [...prev, Array(colsCount).fill('')];
                              });
                            }}
                            className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-750 text-[9px] font-bold text-zinc-300"
                          >
                            + Riga
                          </button>
                        </div>
                      </div>

                      <div className="overflow-x-auto border border-neutral-800 bg-neutral-950/80 rounded-xl max-h-52 overflow-y-auto scrollbar-thin">
                        <table className="w-full text-left border-collapse table-fixed min-w-[400px]">
                          <thead>
                            <tr className="border-b border-neutral-800 bg-neutral-900/40">
                              {tableCells[0]?.map((_, colIdx) => (
                                <th key={colIdx} className="p-1 px-1.5 text-center relative w-32 min-w-28 group">
                                  <div className="flex items-center gap-1">
                                    <textarea
                                      rows={Math.max(1, (tableCells[0][colIdx] || '').split('\n').length)}
                                      className="w-full bg-neutral-900/60 border border-neutral-800 py-1 px-1.5 rounded text-[10px] font-bold text-zinc-200 text-center focus:border-yellow-500 outline-none resize-none font-sans leading-normal"
                                      value={tableCells[0][colIdx]}
                                      onFocus={() => {
                                        setActiveTableStyleTarget(prev => ({ ...prev, rIdx: 0, cIdx: colIdx }));
                                      }}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setTableCells(prev => prev.map((row, r) => r === 0 ? row.map((cell, c) => c === colIdx ? val : cell) : row));
                                      }}
                                      placeholder={`Intestazione ${colIdx + 1}`}
                                    />
                                    <button
                                      type="button"
                                      tabIndex={-1}
                                      onClick={() => {
                                        setTableCells(prev => {
                                          if (prev[0].length <= 1) return prev;
                                          return prev.map(row => row.filter((_, idx) => idx !== colIdx));
                                        });
                                      }}
                                      className="text-red-500 hover:text-red-400 font-bold text-[11px] shrink-0 p-0.5"
                                      title="Elimina colonna"
                                    >
                                      ×
                                    </button>
                                  </div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {tableCells.slice(1).map((row, rowIdx) => {
                              const actualRowIdx = rowIdx + 1;
                              return (
                                <tr key={rowIdx} className="border-b border-neutral-900 leading-none group hover:bg-neutral-900/20">
                                  {row.map((cell, colIdx) => (
                                    <td key={colIdx} className="p-1 px-1.5">
                                      <textarea
                                        rows={Math.max(1, (cell || '').split('\n').length)}
                                        className="w-full bg-transparent border border-transparent hover:border-neutral-800 focus:border-yellow-500 py-1 px-1.5 rounded text-[10px] text-zinc-300 focus:bg-black/60 outline-none resize-none font-sans leading-normal"
                                        value={cell || ''}
                                        onFocus={() => {
                                          setActiveTableStyleTarget(prev => ({ ...prev, rIdx: actualRowIdx, cIdx: colIdx }));
                                        }}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setTableCells(prev => prev.map((r, rIdx) => rIdx === actualRowIdx ? r.map((c, cIdx) => cIdx === colIdx ? val : c) : r));
                                        }}
                                        placeholder="..."
                                      />
                                    </td>
                                  ))}
                                  <td className="w-8 p-1 text-center shrink-0">
                                    <button
                                      type="button"
                                      tabIndex={-1}
                                      onClick={() => {
                                        setTableCells(prev => {
                                          if (prev.length <= 2) return prev; // Keep headers + at least 1 body row
                                          return prev.filter((_, idx) => idx !== actualRowIdx);
                                        });
                                      }}
                                      className="text-red-500 hover:text-red-400 font-extrabold text-xs p-0.5"
                                      title="Elimina riga"
                                    >
                                      ×
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* --- COLOR SELECTOR WIDGET FOR TABLES --- */}
                      <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-3 space-y-2.5 my-2 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-yellow-500 uppercase tracking-wider block">🎨 Colora Elemento Tabella</span>
                          <span className="text-[9px] text-zinc-400">
                            Target Attivo: <span className="font-bold text-white font-mono uppercase bg-neutral-800 px-1.5 py-0.5 rounded">
                              {activeTableStyleTarget.type === 'cell' ? `Cella (${String.fromCharCode(65 + activeTableStyleTarget.cIdx)}${activeTableStyleTarget.rIdx + 1})` :
                               activeTableStyleTarget.type === 'row' ? `Riga ${activeTableStyleTarget.rIdx + 1}` :
                               `Colonna ${String.fromCharCode(65 + activeTableStyleTarget.cIdx)}`}
                            </span>
                          </span>
                        </div>

                        <div className="flex gap-1 bg-black/45 rounded-lg p-0.5 border border-neutral-850">
                          <button
                            type="button"
                            onClick={() => setActiveTableStyleTarget(prev => ({ ...prev, type: 'cell' }))}
                            className={`flex-1 py-1 text-[10px] font-bold rounded transition-colors ${activeTableStyleTarget.type === 'cell' ? 'bg-neutral-850 text-yellow-500' : 'text-neutral-500 hover:text-neutral-300'}`}
                          >
                            Cella (Parola)
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveTableStyleTarget(prev => ({ ...prev, type: 'row' }))}
                            className={`flex-1 py-1 text-[10px] font-bold rounded transition-colors ${activeTableStyleTarget.type === 'row' ? 'bg-neutral-850 text-yellow-500' : 'text-neutral-500 hover:text-neutral-300'}`}
                          >
                            Riga
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveTableStyleTarget(prev => ({ ...prev, type: 'col' }))}
                            className={`flex-1 py-1 text-[10px] font-bold rounded transition-colors ${activeTableStyleTarget.type === 'col' ? 'bg-neutral-850 text-yellow-500' : 'text-neutral-500 hover:text-neutral-300'}`}
                          >
                            Colonna
                          </button>
                        </div>

                        {/* Background color options */}
                        <div className="space-y-2">
                          <div className="text-[9px] text-zinc-500 uppercase font-black">Colore di Sfondo:</div>
                          <div className="flex flex-wrap items-center gap-1">
                            {[
                              { name: 'Nessuno', hex: '' },
                              { name: 'Giallo', hex: '#E5A93C' },
                              { name: 'Blu', hex: '#3B82F6' },
                              { name: 'Verde', hex: '#10B981' },
                              { name: 'Rosso', hex: '#EF4444' },
                              { name: 'Viola', hex: '#8B5CF6' },
                              { name: 'Arancio', hex: '#F97316' },
                              { name: 'Grigio', hex: '#52525B' }
                            ].map(color => (
                              <button
                                key={color.name}
                                type="button"
                                onClick={() => {
                                  const hex = color.hex;
                                  if (hex) addRecentTableColor(hex);
                                  setTableStyles(prev => {
                                    const next = { ...prev };
                                    if (activeTableStyleTarget.type === 'cell') {
                                      const key = `${activeTableStyleTarget.rIdx},${activeTableStyleTarget.cIdx}`;
                                      next.cellColors = { ...next.cellColors };
                                      if (hex) next.cellColors[key] = hex;
                                      else delete next.cellColors[key];
                                    } else if (activeTableStyleTarget.type === 'row') {
                                      next.rowColors = { ...next.rowColors };
                                      if (hex) next.rowColors[activeTableStyleTarget.rIdx] = hex;
                                      else delete next.rowColors[activeTableStyleTarget.rIdx];
                                    } else if (activeTableStyleTarget.type === 'col') {
                                      next.colColors = { ...next.colColors };
                                      if (hex) next.colColors[activeTableStyleTarget.cIdx] = hex;
                                      else delete next.colColors[activeTableStyleTarget.cIdx];
                                    }
                                    return next;
                                  });
                                }}
                                className="px-2.5 py-1 rounded text-[9px] font-bold border border-white/5 transition-all flex items-center gap-1 hover:border-white/20 cursor-pointer"
                                style={{ 
                                  backgroundColor: color.hex ? `${color.hex}22` : 'rgba(255, 255, 255, 0.05)',
                                  color: color.hex || '#a1a1aa',
                                  borderColor: color.hex ? `${color.hex}44` : 'transparent'
                                }}
                              >
                                {color.name}
                              </button>
                            ))}

                            {/* Custom Sfondo Palette */}
                            <label className="relative px-2 py-1 rounded text-[9px] font-bold border border-white/5 bg-neutral-850 hover:bg-neutral-800 hover:border-white/20 transition-all flex items-center gap-1 cursor-pointer text-white">
                              <Palette className="w-3 h-3 text-yellow-500 animate-pulse" />
                              <span>Palette</span>
                              <input 
                                type="color" 
                                className="sr-only" 
                                onChange={(e) => {
                                  const hex = e.target.value;
                                  if (hex) addRecentTableColor(hex);
                                  setTableStyles(prev => {
                                    const next = { ...prev };
                                    if (activeTableStyleTarget.type === 'cell') {
                                      const key = `${activeTableStyleTarget.rIdx},${activeTableStyleTarget.cIdx}`;
                                      next.cellColors = { ...next.cellColors };
                                      next.cellColors[key] = hex;
                                    } else if (activeTableStyleTarget.type === 'row') {
                                      next.rowColors = { ...next.rowColors };
                                      next.rowColors[activeTableStyleTarget.rIdx] = hex;
                                    } else if (activeTableStyleTarget.type === 'col') {
                                      next.colColors = { ...next.colColors };
                                      next.colColors[activeTableStyleTarget.cIdx] = hex;
                                    }
                                    return next;
                                  });
                                }}
                              />
                            </label>
                          </div>

                          {/* Recent background colors list (represented only with colored dots / pallini) */}
                          {recentTableColors.length > 0 && (
                            <div className="flex items-center gap-2 pt-1 border-t border-neutral-850 bg-black/15 p-1.5 rounded-lg">
                              <span className="text-[8px] text-zinc-500 font-bold uppercase shrink-0">Recenti Sfondo:</span>
                              <div className="flex flex-wrap items-center gap-1.5">
                                {recentTableColors.map((hex, idx) => (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => {
                                      addRecentTableColor(hex);
                                      setTableStyles(prev => {
                                        const next = { ...prev };
                                        if (activeTableStyleTarget.type === 'cell') {
                                          const key = `${activeTableStyleTarget.rIdx},${activeTableStyleTarget.cIdx}`;
                                          next.cellColors = { ...next.cellColors };
                                          next.cellColors[key] = hex;
                                        } else if (activeTableStyleTarget.type === 'row') {
                                          next.rowColors = { ...next.rowColors };
                                          next.rowColors[activeTableStyleTarget.rIdx] = hex;
                                        } else if (activeTableStyleTarget.type === 'col') {
                                          next.colColors = { ...next.colColors };
                                          next.colColors[activeTableStyleTarget.cIdx] = hex;
                                        }
                                        return next;
                                      });
                                    }}
                                    className="w-4 h-4 rounded-full border border-white/20 active:scale-90 hover:scale-105 transition-transform shrink-0 cursor-pointer"
                                    style={{ backgroundColor: hex }}
                                    title={hex}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Text color options */}
                        <div className="space-y-2">
                          <span className="text-[9px] text-zinc-500 uppercase font-black">Colore del Testo (Parole/Contenuti):</span>
                          <div className="flex flex-wrap items-center gap-1">
                            {[
                              { name: 'Default', hex: '' },
                              { name: 'Giallo', hex: '#FBBF24' },
                              { name: 'Blu', hex: '#60A5FA' },
                              { name: 'Verde', hex: '#34D399' },
                              { name: 'Rosso', hex: '#F87171' },
                              { name: 'Viola', hex: '#C084FC' },
                              { name: 'Bianco', hex: '#FFFFFF' }
                            ].map(color => (
                              <button
                                key={color.name}
                                type="button"
                                onClick={() => {
                                  const hex = color.hex;
                                  if (hex) addRecentTableColor(hex);
                                  setTableStyles(prev => {
                                    const next = { ...prev };
                                    if (activeTableStyleTarget.type === 'cell') {
                                      const key = `${activeTableStyleTarget.rIdx},${activeTableStyleTarget.cIdx}`;
                                      next.textColors = { ...next.textColors };
                                      if (hex) next.textColors[key] = hex;
                                      else delete next.textColors[key];
                                    } else if (activeTableStyleTarget.type === 'row') {
                                      next.rowTextColors = { ...next.rowTextColors };
                                      if (hex) next.rowTextColors[activeTableStyleTarget.rIdx] = hex;
                                      else delete next.rowTextColors[activeTableStyleTarget.rIdx];
                                    } else if (activeTableStyleTarget.type === 'col') {
                                      next.colTextColors = { ...next.colTextColors };
                                      if (hex) next.colTextColors[activeTableStyleTarget.cIdx] = hex;
                                      else delete next.colTextColors[activeTableStyleTarget.cIdx];
                                    }
                                    return next;
                                  });
                                }}
                                className="px-2.5 py-1 rounded text-[9px] font-bold border border-white/5 transition-all hover:border-white/20 cursor-pointer"
                                style={{ 
                                  color: color.hex || '#a1a1aa'
                                }}
                              >
                                {color.name}
                              </button>
                            ))}

                            {/* Custom Testo Palette */}
                            <label className="relative px-2 py-1 rounded text-[9px] font-bold border border-white/5 bg-neutral-850 hover:bg-neutral-800 hover:border-white/20 transition-all flex items-center gap-1 cursor-pointer text-white">
                              <Palette className="w-3 h-3 text-yellow-500 animate-pulse" />
                              <span>Palette</span>
                              <input 
                                type="color" 
                                className="sr-only" 
                                onChange={(e) => {
                                  const hex = e.target.value;
                                  if (hex) addRecentTableColor(hex);
                                  setTableStyles(prev => {
                                    const next = { ...prev };
                                    if (activeTableStyleTarget.type === 'cell') {
                                      const key = `${activeTableStyleTarget.rIdx},${activeTableStyleTarget.cIdx}`;
                                      next.textColors = { ...next.textColors };
                                      next.textColors[key] = hex;
                                    } else if (activeTableStyleTarget.type === 'row') {
                                      next.rowTextColors = { ...next.rowTextColors };
                                      next.rowTextColors[activeTableStyleTarget.rIdx] = hex;
                                    } else if (activeTableStyleTarget.type === 'col') {
                                      next.colTextColors = { ...next.colTextColors };
                                      next.colTextColors[activeTableStyleTarget.cIdx] = hex;
                                    }
                                    return next;
                                  });
                                }}
                              />
                            </label>
                          </div>

                          {/* Recent text colors list (represented only with colored dots / pallini) */}
                          {recentTableColors.length > 0 && (
                            <div className="flex items-center gap-2 pt-1 border-t border-neutral-850 bg-black/15 p-1.5 rounded-lg">
                              <span className="text-[8px] text-zinc-500 font-bold uppercase shrink-0">Recenti Testo:</span>
                              <div className="flex flex-wrap items-center gap-1.5">
                                {recentTableColors.map((hex, idx) => (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => {
                                      addRecentTableColor(hex);
                                      setTableStyles(prev => {
                                        const next = { ...prev };
                                        if (activeTableStyleTarget.type === 'cell') {
                                          const key = `${activeTableStyleTarget.rIdx},${activeTableStyleTarget.cIdx}`;
                                          next.textColors = { ...next.textColors };
                                          next.textColors[key] = hex;
                                        } else if (activeTableStyleTarget.type === 'row') {
                                          next.rowTextColors = { ...next.rowTextColors };
                                          next.rowTextColors[activeTableStyleTarget.rIdx] = hex;
                                        } else if (activeTableStyleTarget.type === 'col') {
                                          next.colTextColors = { ...next.colTextColors };
                                          next.colTextColors[activeTableStyleTarget.cIdx] = hex;
                                        }
                                        return next;
                                      });
                                    }}
                                    className="w-4 h-4 rounded-full border border-white/20 active:scale-90 hover:scale-105 transition-transform shrink-0 cursor-pointer"
                                    style={{ backgroundColor: hex }}
                                    title={hex}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-[10px] text-zinc-500 font-bold uppercase flex justify-between">
                      <span>Valori Grafico</span>
                      <button 
                        id="add-chart-row-btn"
                        onClick={() => setChartItems(prev => [...prev, { label: `Voce ${prev.length + 1}`, value: 50 }])}
                        className="text-xs text-green-500 font-bold underline"
                      >
                        +{t.addChartRow}
                      </button>
                    </label>

                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {chartItems.map((item, index) => (
                        <div key={index} className="flex gap-1.5 items-center leading-none relative">
                          <input
                            id={`chart-row-label-${index}`}
                            type="text"
                            value={item.label}
                            onChange={(e) => {
                              const val = e.target.value;
                              setChartItems(prev => prev.map((it, idx) => idx === index ? { ...it, label: val } : it));
                            }}
                            placeholder={t.label}
                            className="flex-grow bg-black border border-neutral-800 py-1.5 px-2 rounded-lg text-xs"
                          />
                          <input
                            id={`chart-row-value-${index}`}
                            type="number"
                            value={item.value}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setChartItems(prev => prev.map((it, idx) => idx === index ? { ...it, value: val } : it));
                            }}
                            placeholder={t.value}
                            className="w-16 bg-black border border-neutral-800 py-1.5 px-2 rounded-lg text-xs font-mono"
                          />
                          
                          {/* Tactile Mini-Colorpicker Dot Row/Button */}
                          <div className="relative shrink-0">
                            <button
                              type="button"
                              title="Colore voce"
                              className="w-5 h-5 rounded-full border border-neutral-700 hover:border-zinc-300 transition-all cursor-pointer shadow-md inline-block"
                              style={{ backgroundColor: item.color || settings.primaryColor || '#E5A93C' }}
                              onClick={() => setColorPickerIndex(colorPickerIndex === index ? null : index)}
                            />
                            {colorPickerIndex === index && (
                              <div className="absolute z-50 bg-neutral-900 border border-neutral-800 p-1.5 rounded-xl shadow-2xl flex gap-1.5 bottom-7 right-0 min-w-max animate-in fade-in slide-in-from-bottom-2 duration-150">
                                {[
                                  '#E5A93C', // iOS Yellow
                                  '#ef4444', // Red
                                  '#3b82f6', // Blue
                                  '#22c55e', // Green
                                  '#a855f7', // Purple
                                  '#f97316', // Orange
                                  '#06b6d4', // Cyan
                                  '#f43f5e', // Rose
                                  '#10b981', // Emerald
                                  '#d946ef', // Fuchsia
                                ].map(c => (
                                  <button
                                    key={c}
                                    type="button"
                                    onClick={() => {
                                      setChartItems(prev => prev.map((it, idx) => idx === index ? { ...it, color: c } : it));
                                      setColorPickerIndex(null);
                                    }}
                                    className="w-4.5 h-4.5 rounded-full border border-white/10 hover:border-white shrink-0 transition hover:scale-110 active:scale-90"
                                    style={{ backgroundColor: c }}
                                  />
                                ))}
                              </div>
                            )}
                          </div>

                          <button 
                            id={`remove-chart-row-${index}`}
                            onClick={() => {
                              setChartItems(prev => prev.filter((_, idx) => idx !== index));
                              if (colorPickerIndex === index) setColorPickerIndex(null);
                            }}
                            className="p-1 text-red-500 hover:text-red-400 font-bold text-xs"
                            title="Rimuovi voce"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  id="chart-builder-cancel"
                  onClick={() => setChartBuilderOpen(false)}
                  className="flex-1 py-2 rounded-lg text-xs text-neutral-400 bg-neutral-950 border border-neutral-800"
                >
                  {t.cancel}
                </button>
                <button 
                  id="chart-builder-submit"
                  onClick={handleInsertChart}
                  className="flex-1 py-2 rounded-lg font-bold text-xs bg-yellow-500 text-black hover:bg-yellow-600"
                >
                  {t.insert}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Interactive Link Builder Modal */}
        {linkBuilderOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm" id="link-builder-modal">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-sm p-5 space-y-4 max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-120">
              <h3 className="font-bold text-base text-zinc-100 flex items-center gap-2">
                <Link className="w-5 h-5 text-amber-500" />
                Crea Collegamento (Link)
              </h3>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 font-bold uppercase block">Nome / Titolo</label>
                  <input 
                    id="link-label-input"
                    type="text" 
                    value={linkLabel}
                    onChange={(e) => setLinkLabel(e.target.value)}
                    className="w-full bg-black border border-neutral-800 py-1.5 px-3 rounded-lg text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500"
                    placeholder="Es: Google, Mio Blog, Documento"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 font-bold uppercase block">Indirizzo Web (URL)</label>
                  <input 
                    id="link-url-input"
                    type="text" 
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    className="w-full bg-black border border-neutral-800 py-1.5 px-3 rounded-lg text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500 font-mono"
                    placeholder="https://example.com"
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-black rounded-xl border border-neutral-850">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-neutral-200">Mostra Anteprima</span>
                    <span className="text-[9.5px] text-neutral-500 mt-0.5">Visualizza scheda ricca con favicon</span>
                  </div>
                  <button
                    id="link-preview-toggle-switch"
                    type="button"
                    onClick={() => setLinkShowPreview(!linkShowPreview)}
                    className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-150 focus:outline-none ${linkShowPreview ? 'bg-amber-500' : 'bg-neutral-800'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-150 ${linkShowPreview ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  id="link-builder-cancel"
                  onClick={() => setLinkBuilderOpen(false)}
                  className="flex-1 py-2 rounded-lg text-xs text-neutral-400 bg-neutral-950 border border-neutral-800 hover:bg-neutral-900 transition-colors"
                >
                  {t.cancel}
                </button>
                <button 
                  id="link-builder-submit"
                  onClick={handleInsertLink}
                  disabled={!linkUrl.trim()}
                  className="flex-1 py-2 rounded-lg font-bold text-xs bg-amber-500 text-black hover:bg-amber-600 disabled:opacity-50 transition-all font-sans"
                >
                  {t.insert}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- 5. NOTE QUICK ACTIONS LONG PRESS MODAL OVERLAY --- */}
        {contextMenuNote && (
          <div 
            onClick={() => setContextMenuNote(null)}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center animate-in fade-in duration-250 cursor-pointer"
            id="note-longpress-context-menu"
          >
            {/* The Sheet Container */}
            <div 
              onClick={(e) => e.stopPropagation()}
              className="bg-neutral-950 border-t border-neutral-850 rounded-t-3xl w-full max-w-lg p-5 pb-8 space-y-4 animate-in slide-in-from-bottom duration-200 cursor-default"
            >
              {/* Top notch indicator resembling professional bottom sheets */}
              <div className="w-12 h-1 bg-neutral-800 rounded-full mx-auto mb-2" />
              
              {/* Header block with Note Preview/Info */}
              <div className="bg-neutral-900/60 p-4 rounded-2xl border border-neutral-800 flex flex-col gap-1.5 shadow-inner">
                <span className="text-[10px] text-yellow-500 font-bold uppercase tracking-wider">Note Info</span>
                <h4 className="font-bold text-base text-neutral-100 truncate">{contextMenuNote.title || t.unnamedNote}</h4>
                <p className="text-xs text-neutral-400 truncate">
                  {contextMenuNote.customPreview !== undefined && contextMenuNote.customPreview !== "" ? contextMenuNote.customPreview : contextMenuNote.content.replace(/<[^>]*>/g, '').trim().substring(0, 100) || t.emptyNoteBody}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] bg-neutral-800 text-neutral-450 py-0.5 px-2 rounded font-mono">
                    {new Date(contextMenuNote.updatedAt).toLocaleString(settings.language === 'it' ? 'it-IT' : 'en-US')}
                  </span>
                  <span className="text-[10px] bg-yellow-500/10 text-yellow-500 py-0.5 px-2 rounded font-bold">
                    {folders.find(f => f.id === contextMenuNote.folderId)?.name || 'Note'}
                  </span>
                </div>
              </div>

              {/* Action grid options */}
              <div className="grid grid-cols-2 gap-2.5">
                {/* Pin Action option */}
                <button
                  id="longpress-pin-btn"
                  onClick={() => {
                    handleToggleNotePin(contextMenuNote.id);
                    setContextMenuNote(null);
                  }}
                  className="flex items-center gap-3 p-3.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-left transition-colors font-medium text-sm text-neutral-200 cursor-pointer"
                >
                  <span className="p-1.5 rounded-lg bg-yellow-500/10 text-yellow-500">
                    <Pin className={`w-4 h-4 ${contextMenuNote.pinned ? 'fill-current' : ''}`} />
                  </span>
                  <div>
                    <p className="font-bold text-xs">{contextMenuNote.pinned ? t.unpin : t.pin}</p>
                    <span className="text-[9px] text-zinc-500">{contextMenuNote.pinned ? "Non mostrare in alto" : "Fissa nella sezione evidenza"}</span>
                  </div>
                </button>

                {/* Password Lock protection */}
                <button
                  id="longpress-lock-btn"
                  onClick={() => {
                    const noteId = contextMenuNote.id;
                    setContextMenuNote(null);
                    // Open password lock setter
                    setTimeout(() => handleSetPasswordToNote(noteId), 250);
                  }}
                  className="flex items-center gap-3 p-3.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-left transition-colors font-medium text-sm text-neutral-200 cursor-pointer"
                >
                  <span className="p-1.5 rounded-lg bg-red-500/10 text-red-400">
                    {contextMenuNote.passwordLocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  </span>
                  <div>
                    <p className="font-bold text-xs">{contextMenuNote.passwordLocked ? t.lock : t.lock}</p>
                    <span className="text-[9px] text-zinc-500">{contextMenuNote.passwordLocked ? "Rimuovi protezione" : "Imposta codice segreto"}</span>
                  </div>
                </button>

                {/* Move folder option */}
                <button
                  id="longpress-move-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    const noteId = contextMenuNote.id;
                    setContextMenuNote(null);
                    setTimeout(() => handleMoveNoteClick(noteId), 250);
                  }}
                  className="flex items-center gap-3 p-3.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-left transition-colors font-medium text-sm text-neutral-200 cursor-pointer"
                >
                  <span className="p-1.5 rounded-lg bg-pink-500/10 text-pink-400">
                    <FolderSync className="w-4 h-4" />
                  </span>
                  <div>
                    <p className="font-bold text-xs">{t.move}</p>
                    <span className="text-[9px] text-zinc-500 font-sans">Invia ad altra cartella</span>
                  </div>
                </button>

                {/* Duplicate duplicate note */}
                <button
                  id="longpress-duplicate-btn"
                  onClick={(e) => {
                    handleDuplicateNote(contextMenuNote, e);
                    setContextMenuNote(null);
                  }}
                  className="flex items-center gap-3 p-3.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-left transition-colors font-medium text-sm text-neutral-200 cursor-pointer"
                >
                  <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                    <Copy className="w-4 h-4" />
                  </span>
                  <div>
                    <p className="font-bold text-xs">{t.duplicate}</p>
                    <span className="text-[9px] text-zinc-500">Crea copia al volo</span>
                  </div>
                </button>

                {/* Export text option */}
                <button
                  id="longpress-export-btn"
                  onClick={(e) => {
                    handleExportTextFile(contextMenuNote, e);
                    setContextMenuNote(null);
                  }}
                  className="flex items-center gap-3 p-3.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-left transition-colors font-medium text-sm text-neutral-200 cursor-pointer"
                >
                  <span className="p-1.5 rounded-lg bg-[#E5A93C]/10 text-[#E5A93C]">
                    <FileText className="w-4 h-4" />
                  </span>
                  <div>
                    <p className="font-bold text-xs">Esporta .TXT</p>
                    <span className="text-[9px] text-zinc-500">Download di testo</span>
                  </div>
                </button>

                {/* Rename / Custom Preview option */}
                <button
                  id="longpress-rename-preview-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    const note = contextMenuNote;
                    setContextMenuNote(null);
                    setTimeout(() => {
                      setRenamePreviewNoteId(note.id);
                      setNewNoteTitle(note.title);
                      setNewNoteCustomPreview(note.customPreview || '');
                      setIsRenamePreviewModalOpen(true);
                    }, 250);
                  }}
                  className="flex items-center gap-3 p-3.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-left transition-colors font-medium text-sm text-neutral-200 cursor-pointer col-span-2"
                >
                  <span className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400">
                    <Edit className="w-4 h-4" />
                  </span>
                  <div>
                    <p className="font-bold text-xs">Rinomina & Anteprima</p>
                    <span className="text-[9px] text-zinc-500">Modifica titolo o fissa anteprima differente dal testo reale</span>
                  </div>
                </button>

                {/* DELETE / TRASH ACTION - PROMINENTLY RED */}
                <button
                  id="longpress-delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    const noteId = contextMenuNote.id;
                    setContextMenuNote(null);
                    setTimeout(() => handleDeleteNote(noteId), 150);
                  }}
                  className="flex items-center gap-3 p-3.5 rounded-xl bg-red-950/25 hover:bg-red-950/45 border border-red-500/20 text-left transition-colors font-medium text-sm text-red-200 col-span-2 group/btn cursor-pointer"
                >
                  <span className="p-2 rounded-lg bg-red-500/20 text-red-500 group-hover/btn:bg-red-500 group-hover/btn:text-black transition-colors duration-200">
                    <Trash2 className="w-5 h-5" />
                  </span>
                  <div>
                    <p className="font-extrabold text-sm text-red-400">{t.delete}</p>
                    <span className="text-[10px] text-red-500/55 font-semibold">Rimuovi stabilmente dal taccuino</span>
                  </div>
                </button>
              </div>

              {/* Cancel closing button overlay */}
              <button 
                id="longpress-cancel-btn"
                onClick={() => setContextMenuNote(null)}
                className="w-full py-3 rounded-2xl bg-neutral-900 hover:bg-neutral-850 text-neutral-400 text-xs font-bold transition-colors border border-neutral-850 block mt-2 cursor-pointer"
              >
                {t.cancel}
              </button>
            </div>
          </div>
        )}

        {/* --- 6. FOLDER QUICK ACTIONS LONG PRESS MODAL OVERLAY --- */}
        {contextMenuFolder && (
          <div 
            onClick={() => setContextMenuFolder(null)}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center animate-in fade-in duration-250 cursor-pointer"
            id="folder-longpress-context-menu"
          >
            {/* The Sheet Container */}
            <div 
              onClick={(e) => e.stopPropagation()}
              className="bg-neutral-950 border-t border-neutral-850 rounded-t-3xl w-full max-w-lg p-5 pb-8 space-y-4 animate-in slide-in-from-bottom duration-200 cursor-default"
            >
              {/* Top notch indicator resembling professional bottom sheets */}
              <div className="w-12 h-1 bg-neutral-800 rounded-full mx-auto mb-2" />
              
              {/* Header block with Folder Info */}
              <div className="bg-neutral-900/60 p-4 rounded-2xl border border-neutral-800 flex flex-col gap-1.5 shadow-inner">
                <span className="text-[10px] text-yellow-500 font-bold uppercase tracking-wider font-sans">
                  {contextMenuFolder.parentId ? 'Sottocartella' : 'Cartella'}
                </span>
                <h4 className="font-bold text-base text-neutral-100 truncate font-sans">{contextMenuFolder.name}</h4>
                {contextMenuFolder.description && (
                  <p className="text-xs text-neutral-450 italic font-sans">
                    Descrizione: "{contextMenuFolder.description}"
                  </p>
                )}
              </div>

              {/* Action grid options */}
              <div className="grid grid-cols-2 gap-2.5 font-sans">
                
                {/* Description Button */}
                <button
                  id="folder-action-edit-desc"
                  onClick={() => {
                    setEditingFolderId(contextMenuFolder.id);
                    setFolderDescriptionInput(contextMenuFolder.description || '');
                    setIsDescriptionEditOpen(true);
                    setContextMenuFolder(null); // Close context menu
                  }}
                  className="flex items-center gap-3 p-3.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-left transition-colors font-medium text-sm text-neutral-200 cursor-pointer"
                >
                  <span className="p-1.5 rounded-lg bg-yellow-500/10 text-yellow-500">
                    <FileText className="w-4 h-4" />
                  </span>
                  <div>
                    <p className="font-bold text-xs">Descrizione</p>
                    <span className="text-[9px] text-zinc-500">Aggiungi o modifica testo</span>
                  </div>
                </button>

                {/* Remove Description Button */}
                <button
                  id="folder-action-clear-desc-btn"
                  onClick={() => {
                    setFolders(prev => prev.map(f => f.id === contextMenuFolder.id ? { 
                      ...f, 
                      description: undefined 
                    } : f));
                    setFolderDescriptionInput('');
                    setContextMenuFolder(null); // Close context menu
                  }}
                  disabled={!contextMenuFolder.description}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-colors font-medium text-sm cursor-pointer transition ${
                    contextMenuFolder.description 
                      ? 'bg-neutral-900 hover:bg-red-950/20 border-neutral-800 hover:border-red-500/20 text-neutral-200' 
                      : 'bg-neutral-950 border-neutral-900 text-neutral-600 cursor-not-allowed opacity-50'
                  }`}
                  title={settings.language === 'it' ? 'Rimuovi il testo della descrizione' : 'Remove the description text'}
                >
                  <span className={`p-1.5 rounded-lg ${contextMenuFolder.description ? 'bg-red-500/10 text-red-400' : 'bg-neutral-900 text-neutral-600'}`}>
                    <Trash2 className="w-4 h-4" />
                  </span>
                  <div>
                    <p className="font-bold text-xs">{settings.language === 'it' ? 'Elimina Descrizione' : 'Delete Description'}</p>
                    <span className="text-[9px] text-zinc-500">Cancella testo descrittivo</span>
                  </div>
                </button>

                {/* Show/Hide Description Toggle */}
                <button
                  id="folder-action-toggle-desc"
                  onClick={() => {
                    const nextVal = !(contextMenuFolder.showDescription ?? true);
                    setFolders(prev => prev.map(f => f.id === contextMenuFolder.id ? { 
                      ...f, 
                      showDescription: nextVal 
                    } : f));
                    setFolderShowDescriptionInput(nextVal);
                    setContextMenuFolder(prev => prev ? { ...prev, showDescription: nextVal } : null);
                  }}
                  className="flex items-center gap-3 p-3.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-left transition-colors font-medium text-sm text-neutral-200 cursor-pointer"
                >
                  <span className={`p-1.5 rounded-lg ${(contextMenuFolder.showDescription ?? true) ? 'bg-emerald-500/10 text-emerald-400' : 'bg-neutral-850 text-neutral-550'}`}>
                    <Sliders className="w-4 h-4" />
                  </span>
                  <div>
                    <p className="font-bold text-xs">
                      {(contextMenuFolder.showDescription ?? true) ? 'Nascondi Descrizione' : 'Mostra Descrizione'}
                    </p>
                    <span className="text-[9px] text-zinc-500">Visibilità nello schedario</span>
                  </div>
                </button>

                {/* Edit/Rename Folder (Modifica sottocartella / cartella) */}
                <button
                  id="folder-action-rename-btn"
                  onClick={() => {
                    const folderId = contextMenuFolder.id;
                    setEditingFolderId(folderId);
                    setFolderNameInput(contextMenuFolder.name);
                    setFolderParentIdInput(contextMenuFolder.parentId || '');
                    setContextMenuFolder(null); // close hold sheet
                    setIsNewFolderModalOpen(true); // open normal rename/edit dialog
                  }}
                  className="flex items-center gap-3 p-3.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-left transition-colors font-medium text-sm text-neutral-200 cursor-pointer"
                >
                  <span className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400">
                    <Edit className="w-4 h-4" />
                  </span>
                  <div>
                    <p className="font-bold text-xs">{settings.language === 'it' ? 'Rinomina / Sposta' : 'Rename / Move'}</p>
                    <span className="text-[9px] text-zinc-500">Riorganizza gerarchia</span>
                  </div>
                </button>

                {/* Delete Entire Folder */}
                <button
                  id="folder-action-del-folder-only"
                  onClick={(e) => {
                    e.stopPropagation();
                    const folderId = contextMenuFolder.id;
                    setContextMenuFolder(null);
                    handleDeleteFolder(folderId, e as any);
                  }}
                  className="flex items-center gap-3 p-3.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-left transition-colors font-medium text-sm text-neutral-200 cursor-pointer"
                >
                  <span className="p-1.5 rounded-lg bg-red-500/10 text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </span>
                  <div>
                    <p className="font-bold text-xs">{settings.language === 'it' ? 'Elimina Cartella' : 'Delete Folder'}</p>
                    <span className="text-[9px] text-zinc-500">Rimuovi contenitore</span>
                  </div>
                </button>

                {/* Delete All Notes inside Folder */}
                <button
                  id="folder-action-delete-notes"
                  onClick={handleDeleteAllNotesInFolder}
                  className="flex items-center gap-3 p-3.5 rounded-xl bg-red-950/20 hover:bg-red-950/35 border border-red-500/20 text-left transition-colors font-medium text-sm text-red-250 col-span-2 cursor-pointer group/btn"
                >
                  <span className="p-1.5 rounded-lg bg-red-500/25 text-red-400 group-hover/btn:bg-red-500 group-hover/btn:text-neutral-950 transition-colors">
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </span>
                  <div>
                    <p className="font-bold text-xs">Elimina tutte le note dalla cartella</p>
                    <span className="text-[9px] text-red-500/50">Svuota all'istante l'intero contenuto della cartella</span>
                  </div>
                </button>

                {/* Delete All Subfolders of this Folder */}
                <button
                  id="folder-action-delete-subfolders"
                  onClick={handleDeleteAllSubfolders}
                  className="flex items-center gap-3 p-3.5 rounded-xl bg-orange-950/20 hover:bg-orange-950/35 border border-orange-500/20 text-left transition-colors font-medium text-sm text-orange-200 col-span-2 cursor-pointer group/btn"
                >
                  <span className="p-1.5 rounded-lg bg-orange-500/25 text-orange-400 group-hover/btn:bg-orange-500 group-hover/btn:text-neutral-950 transition-colors">
                    <FolderSync className="w-4 h-4 text-orange-400" />
                  </span>
                  <div>
                    <p className="font-bold text-xs">Elimina tutte le sottocartelle</p>
                    <span className="text-[9px] text-orange-500/50">Riconosce ed elimina tutte le sue sottocartelle</span>
                  </div>
                </button>

              </div>

              {/* Cancel closing button overlay */}
              <button 
                id="folder-longpress-cancel-btn"
                onClick={() => setContextMenuFolder(null)}
                className="w-full py-3 rounded-2xl bg-neutral-900 hover:bg-neutral-850 text-neutral-400 text-xs font-bold transition-colors border border-neutral-850 block mt-2 cursor-pointer cursor-pointer"
              >
                {t.cancel}
              </button>
            </div>
          </div>
        )}

        {/* Fullscreen Video/Image Viewer Overlay Modal */}
        {fullscreenMediaUrl && (
          <div 
            onClick={() => {
              setFullscreenMediaUrl(null);
              setFullscreenMediaType(null);
            }}
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 cursor-zoom-out"
            id="fullscreen-viewer-modal"
          >
            {fullscreenMediaType === 'image' ? (
              <img 
                src={fullscreenMediaUrl} 
                className="max-w-full max-h-[90vh] object-contain rounded-lg animate-in zoom-in-95" 
                alt="Fullscreen"
              />
            ) : fullscreenMediaType === 'table' && fullscreenTableData ? (
              <div 
                onClick={(e) => e.stopPropagation()}
                className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl max-w-5xl w-full max-h-[85vh] overflow-auto animate-in zoom-in-95 select-text cursor-default"
              >
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-neutral-800">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">📋</span>
                    <h3 className="font-extrabold text-white text-base">Visualizzazione Schermo Intero</h3>
                  </div>
                  <button 
                    onClick={() => {
                      setFullscreenMediaUrl(null);
                      setFullscreenMediaType(null);
                      setFullscreenTableData(null);
                      setFullscreenTableStyles(null);
                    }}
                    className="p-1.5 px-3 bg-neutral-850 hover:bg-neutral-800 text-neutral-300 font-bold text-xs rounded-lg transition animate-pulse"
                  >
                    Esci ✕
                  </button>
                </div>
                <div className="overflow-x-auto w-full">
                  {renderFullscreenTableCharts(fullscreenTableData[0] || [], fullscreenTableData.slice(1), settings.primaryColor || '#E5A93C')}
                  
                  <div className="excel-grid-container w-full overflow-x-auto select-text my-2 rounded-xl border border-neutral-800/80 bg-neutral-950 p-2 scrollbar-thin">
                    <table className="w-full text-left border-collapse table-auto text-xs min-w-max" style={{ fontSize: '11px' }}>
                      <thead>
                        {/* Row 1: Column Letters (A, B, C...) */}
                        <tr className="bg-neutral-950 border-b border-neutral-800 font-mono text-[9px] text-neutral-500">
                          <th className="p-1.5 text-center bg-neutral-950 border border-neutral-850 w-8 min-w-[32px] select-none"></th>
                          {fullscreenTableData[0]?.map((_, hIdx) => {
                            const colBgColor = fullscreenTableStyles?.colColors?.[hIdx] || '';
                            const style = colBgColor ? { backgroundColor: `${colBgColor}22`, borderBottom: `2px solid ${colBgColor}` } : {};
                            return (
                              <th 
                                key={hIdx} 
                                className="p-1.5 text-center bg-neutral-950/80 border border-neutral-850 select-none font-bold" 
                                style={style}
                              >
                                {String.fromCharCode(65 + hIdx)}
                              </th>
                            );
                          })}
                        </tr>

                        {/* Row 2: Actual Text Headers */}
                        <tr className="border-b border-neutral-800 font-mono text-xs">
                          <th className="p-1.5 px-2 text-center text-neutral-500 font-mono text-[10px] bg-neutral-950/70 border border-neutral-850 w-8 select-none">1</th>
                          {fullscreenTableData[0]?.map((h, hIdx) => {
                            const colBgColor = fullscreenTableStyles?.colColors?.[hIdx] || '';
                            const colCellKey = `0,${hIdx}`;
                            const cellBg = fullscreenTableStyles?.cellColors?.[colCellKey] || colBgColor;
                            const cellText = fullscreenTableStyles?.textColors?.[colCellKey] || fullscreenTableStyles?.rowTextColors?.[0] || fullscreenTableStyles?.colTextColors?.[hIdx] || '';
                            
                            const bgStyle = cellBg ? { backgroundColor: `${cellBg}22`, borderBottom: `2px solid ${cellBg}` } : { backgroundColor: 'rgba(255, 255, 255, 0.02)' };
                            const textStyle = cellText ? { color: cellText, fontWeight: 'bold' } : {};
                            
                            return (
                              <th 
                                key={hIdx} 
                                className="p-2 py-2 text-zinc-100 font-bold select-text uppercase tracking-wider text-[10px] border border-neutral-855" 
                                style={{ ...bgStyle, ...textStyle }}
                              >
                                {h || ''}
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {fullscreenTableData.slice(1).map((row, rIdx) => {
                          const actualExcelRow = rIdx + 2;
                          const tableRowIdx = rIdx + 1; // 1-based indexing for rows (headers are 0)
                          const rowBgColor = fullscreenTableStyles?.rowColors?.[tableRowIdx] || '';
                          const rowStyle = rowBgColor ? { backgroundColor: `${rowBgColor}15` } : {};
                          
                          return (
                            <tr key={rIdx} className="border-b border-neutral-900 hover:bg-neutral-900/30 transition-colors" style={rowStyle}>
                              {/* Left row index cell */}
                              <td 
                                className="p-2 text-center text-neutral-500 font-mono text-[10px] bg-neutral-950/40 border border-neutral-850 w-8 select-none"
                                style={rowBgColor ? { borderLeft: `3px solid ${rowBgColor}`, fontWeight: 'bold' } : {}}
                              >
                                {actualExcelRow}
                              </td>
                              
                              {fullscreenTableData[0]?.map((_, cIdx) => {
                                const rawVal = row[cIdx] || '';
                                let evaluated = rawVal;
                                if (rawVal.startsWith('=')) {
                                  try {
                                    evaluated = evaluateExcelCell(rawVal, fullscreenTableData);
                                  } catch (err) {
                                    evaluated = rawVal;
                                  }
                                }
                                
                                const cellKey = `${tableRowIdx},${cIdx}`;
                                const cellBgColor = fullscreenTableStyles?.cellColors?.[cellKey];
                                const cellTextColor = fullscreenTableStyles?.textColors?.[cellKey] || fullscreenTableStyles?.rowTextColors?.[tableRowIdx] || fullscreenTableStyles?.colTextColors?.[cIdx];
                                
                                const cellStyle: React.CSSProperties = {
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'normal',
                                  overflowWrap: 'break-word',
                                  wordWrap: 'break-word',
                                };
                                
                                if (cellBgColor) {
                                  cellStyle.backgroundColor = `${cellBgColor}22`;
                                  cellStyle.border = `1.5px solid ${cellBgColor}55`;
                                } else {
                                  const colBgColor = fullscreenTableStyles?.colColors?.[cIdx];
                                  if (colBgColor) {
                                    cellStyle.backgroundColor = `${colBgColor}10`;
                                  } else if (rowBgColor) {
                                    cellStyle.backgroundColor = `${rowBgColor}10`;
                                  }
                                }
                                
                                if (cellTextColor) {
                                  cellStyle.color = cellTextColor;
                                  cellStyle.fontWeight = 'bold';
                                }
                                
                                return (
                                  <td 
                                    key={cIdx} 
                                    className="p-2 py-2 text-zinc-300 font-medium select-text border border-neutral-900/30" 
                                    style={cellStyle}
                                  >
                                    {evaluated}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : fullscreenMediaType === 'chart' && fullscreenChartType ? (
              <div 
                onClick={(e) => e.stopPropagation()}
                className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl max-w-xl w-full animate-in zoom-in-95 cursor-default select-none"
              >
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-neutral-800">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">📊</span>
                    <h3 className="font-extrabold text-white text-base">{fullscreenChartName || 'Grafico'}</h3>
                  </div>
                  <button 
                    onClick={() => {
                      setFullscreenMediaUrl(null);
                      setFullscreenMediaType(null);
                      setFullscreenChartType(null);
                      setFullscreenChartItems([]);
                    }}
                    className="p-1.5 px-3 bg-neutral-850 hover:bg-neutral-800 text-neutral-300 font-bold text-xs rounded-lg transition"
                  >
                    Esci ✕
                  </button>
                </div>
                
                {/* Chart body */}
                <div className="py-4 space-y-4">
                  {fullscreenChartType === 'bar' ? (
                    <div className="space-y-3.5 max-h-[50vh] overflow-y-auto pr-1">
                      {fullscreenChartItems.map((item, idx) => {
                        const pct = Math.max(5, Math.min(100, item.value));
                        const color = item.color || settings.primaryColor || '#E5A93C';
                        return (
                          <div key={idx} className="space-y-1.5">
                            <div className="flex justify-between text-xs text-neutral-400">
                              <span className="font-bold text-zinc-300">{item.label}</span>
                              <span className="font-mono font-black text-white">{item.value}</span>
                            </div>
                            <div className="w-full bg-neutral-800 rounded-full h-3 overflow-hidden">
                              <div 
                                className="h-full rounded-full transition-all duration-500" 
                                style={{ width: `${pct}%`, backgroundColor: color }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : fullscreenChartType === 'line' ? (
                    <div className="h-64 flex items-end justify-between px-4 pt-10 pb-4 relative select-none">
                      <div className="absolute inset-x-0 bottom-0 border-b border-neutral-800"></div>
                      {fullscreenChartItems.map((item, idx) => {
                        const pct = Math.max(10, Math.min(100, item.value));
                        const color = item.color || settings.primaryColor || '#E5A93C';
                        return (
                          <div key={idx} className="flex flex-col items-center gap-2 flex-grow relative z-10">
                            <span 
                              className="text-[10px] font-mono font-bold text-neutral-200 bg-neutral-950 py-0.5 px-1.5 rounded border border-neutral-800" 
                              style={{ borderColor: `${color}44` }}
                            >
                              {item.value}
                            </span>
                            <div 
                              className="w-2.5 rounded-t transition-all duration-500 ease-out" 
                              style={{ height: `${pct * 1.5}px`, backgroundColor: color }}
                            />
                            <span className="text-[10px] font-bold text-neutral-500 truncate max-w-[60px] mt-2 select-none">{item.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    // Pie chart list
                    <div className="flex flex-col items-center justify-center py-6 gap-6">
                      <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
                        {fullscreenChartItems.map((item, idx) => {
                          const colors = ['#eab308', '#3b82f6', '#ef4444', '#10b981', '#a855f7', '#f97316'];
                          const color = item.color || colors[idx % colors.length];
                          return (
                            <div key={idx} className="flex items-center gap-2 p-2 bg-black/15 border border-white/5 rounded-xl text-xs">
                              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }}></span>
                              <span className="text-zinc-400 truncate max-w-[90px]">{item.label}:</span>
                              <span className="font-bold text-white font-mono ml-auto">{item.value}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <video 
                src={fullscreenMediaUrl} 
                className="max-w-full max-h-[90vh] object-contain rounded-lg animate-in zoom-in-95 bg-black" 
                controls 
                autoPlay
              />
            )}
            <span className="absolute top-4 right-4 text-xs bg-black/60 text-white p-2 px-4 rounded-full font-bold">Chiudi / Click to Exit</span>
          </div>
        )}

        {/* Hand free Sketch Pad Modal */}
        {isDrawingOpen && (
          <DrawingCanvas 
            language={settings.language}
            onSave={handleSaveDrawing}
            onClose={() => setIsDrawingOpen(false)}
          />
        )}

        {/* --- CUSTOM DIALOG CONFIRMATION OVERLAY --- */}
        {confirmDialog && confirmDialog.isOpen && (
          <div 
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
            id="custom-confirm-dialog"
            onClick={() => setConfirmDialog(null)}
          >
            <div 
              className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-sm p-5 space-y-4 animate-in zoom-in-95 duration-150 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-1">
                <h3 className="font-extrabold text-base text-neutral-100">{confirmDialog.title}</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">{confirmDialog.description}</p>
              </div>
              
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  id="confirm-cancel-btn"
                  onClick={() => setConfirmDialog(null)}
                  className="px-4 py-2 rounded-xl text-neutral-400 bg-neutral-850 hover:bg-neutral-800 text-xs font-bold transition-colors cursor-pointer"
                >
                  {confirmDialog.cancelText}
                </button>
                <button
                  id="confirm-execute-btn"
                  onClick={() => {
                    confirmDialog.onConfirm();
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    confirmDialog.isDestructive 
                      ? 'bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-900/10' 
                      : 'bg-yellow-500 hover:bg-yellow-600 text-neutral-950 font-bold'
                  }`}
                >
                  {confirmDialog.confirmText}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- CUSTOM RENAME & PREVIEW MODAL OVERLAY --- */}
        {isRenamePreviewModalOpen && (
          <div 
            className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
            id="rename-preview-dialog-overlay"
            onClick={() => setIsRenamePreviewModalOpen(false)}
          >
            <div 
              className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-md p-6 space-y-5 animate-in zoom-in-95 duration-150 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-1">
                <h3 className="font-extrabold text-lg text-neutral-100 flex items-center gap-2">
                  <Edit className="w-5 h-5 text-teal-400" />
                  Rinomina & Anteprima
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Modifica il titolo della nota o specifica un testo d'anteprima differente per l'elenco.
                </p>
              </div>

              <div className="space-y-4">
                {/* Custom Title Input */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Titolo della nota</label>
                  <input
                    type="text"
                    value={newNoteTitle}
                    onChange={(e) => setNewNoteTitle(e.target.value)}
                    placeholder="Senza titolo"
                    className="w-full py-2.5 px-3.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-zinc-200 placeholder-neutral-600 focus:outline-none focus:border-teal-500 transition-colors"
                  />
                </div>

                {/* Custom Preview Text Overriding Actual Document Snippet */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Anteprima personalizzata</label>
                  <textarea
                    rows={3}
                    value={newNoteCustomPreview}
                    onChange={(e) => setNewNoteCustomPreview(e.target.value)}
                    placeholder="Esempio: Una nota privata importante... (Lascia vuoto per usare il testo reale)"
                    className="w-full py-2.5 px-3.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-zinc-200 placeholder-neutral-600 focus:outline-none focus:border-teal-500 transition-colors resize-none"
                  />
                  <p className="text-[10px] text-zinc-500 leading-normal">
                    Se inserito, questo testo verrà visualizzato nell'elenco delle note invece del testo reale del documento.
                  </p>
                </div>
              </div>
              
              <div className="flex items-center justify-end gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setIsRenamePreviewModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-neutral-400 bg-neutral-850 hover:bg-neutral-800 text-xs font-bold transition-colors cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={handleSaveRenamePreview}
                  className="px-5 py-2.5 rounded-xl text-xs font-extrabold transition-colors cursor-pointer bg-teal-500 hover:bg-teal-600 text-black shadow-lg shadow-teal-900/10"
                >
                  Salva modifiche
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
