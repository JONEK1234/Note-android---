export interface Attachment {
  id: string;
  type: 'image' | 'video' | 'audio' | 'file' | 'drawing' | 'chart' | 'link';
  name: string;
  url: string; // Base64 data-url for local storage persistence
  size?: string;
  width?: number; // percentage width for responsive resizing e.g. 50, 100
  chartData?: { label: string; value: number; color?: string }[]; // For integrated charts
  chartType?: 'bar' | 'line' | 'pie' | 'table';
  tableData?: string[][]; // For table charts
  tableStyles?: {
    rowColors?: { [rowIdx: number]: string };
    colColors?: { [colIdx: number]: string };
    cellColors?: { [cellKey: string]: string };
    textColors?: { [cellKey: string]: string };
    rowTextColors?: { [rowIdx: number]: string };
    colTextColors?: { [colIdx: number]: string };
  };
}

export interface Note {
  id: string;
  folderId: string;
  title: string;
  content: string; // HTML formatted string with color styles
  pinned: boolean;
  passwordLocked: boolean;
  password?: string; // encrypted or clear text password for local lock
  createdAt: number;
  updatedAt: number;
  color?: string; // custom highlight or note theme
  attachments: Attachment[];
  linedPaper?: boolean; // Lined paper lines enabled for this specific note
  customPreview?: string; // Custom override preview text for display
}

export interface Folder {
  id: string;
  name: string;
  pinned: boolean;
  isSystem?: boolean; // e.g. "Tutte le note", "In evidenza"
  parentId?: string; // Parent folder ID for subfolders
  description?: string; // Optional folder description
  showDescription?: boolean; // Toggle flag to show/hide the description
}

export interface AppSettings {
  language: 'it' | 'en';
  primaryColor: string; // Hex color for the app's brand, default to iOS yellow #E5A93C
  fontSize: 'sm' | 'md' | 'lg' | 'xl';
  fontFamily: 'system' | 'serif' | 'monospace' | 'handwritten';
  launchFolderId: string; // 'all' or specific folder ID
  linedPaper?: boolean; // Global setting for lined paper
}
