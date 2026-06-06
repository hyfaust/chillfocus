import { useState, useRef, useCallback } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { generateId } from '../utils/timeUtils';
import styles from './StickyNotes.module.css';

interface StickyNote {
  id: string;
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  pinned: boolean;
  createdAt: number;
}

const NOTE_COLORS = ['#ffd43b', '#ff8787', '#74c0fc', '#69db7c', '#da77f2', '#ffa94d'];
const DEFAULT_W = 160;
const DEFAULT_H = 100;
const MIN_W = 80;
const MIN_H = 60;

export default function StickyNotes() {
  const [notes, setNotes] = useLocalStorage<StickyNote[]>('chillfocus-notes', []);
  const [visible, setVisible] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const iconRef = useRef<HTMLDivElement>(null);

  const addNote = useCallback((x: number, y: number) => {
    const note: StickyNote = {
      id: generateId(),
      text: '',
      x, y,
      w: DEFAULT_W,
      h: DEFAULT_H,
      color: NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)],
      pinned: false,
      createdAt: Date.now(),
    };
    setNotes(prev => [...prev, note]);
    setEditingId(note.id);
    setEditText('');
    if (!visible) setVisible(true);
  }, [setNotes, visible]);

  const updateNoteText = useCallback((id: string, text: string) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, text } : n));
    setEditingId(null);
  }, [setNotes]);

  const updateNotePosition = useCallback((id: string, x: number, y: number) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, x, y } : n));
  }, [setNotes]);

  const updateNoteSize = useCallback((id: string, w: number, h: number) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, w, h } : n));
  }, [setNotes]);

  const deleteNote = useCallback((id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
  }, [setNotes]);

  const cycleColor = useCallback((id: string) => {
    setNotes(prev => prev.map(n => {
      if (n.id !== id) return n;
      const idx = NOTE_COLORS.indexOf(n.color);
      return { ...n, color: NOTE_COLORS[(idx + 1) % NOTE_COLORS.length] };
    }));
  }, [setNotes]);

  const togglePin = useCallback((id: string) => {
    setNotes(prev => prev.map(n => {
      if (n.id !== id) return n;
      if (!n.pinned) {
        // floating → pinned: convert viewport coords to page coords
        return { ...n, pinned: true, x: n.x + window.scrollX, y: n.y + window.scrollY };
      } else {
        // pinned → floating: convert page coords to viewport coords
        return { ...n, pinned: false, x: n.x - window.scrollX, y: n.y - window.scrollY };
      }
    }));
  }, [setNotes]);

  // Icon drag via mouse events (more reliable in WebView)
  const handleIconMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    let moved = false;

    const onMouseMove = (ev: MouseEvent) => {
      if (Math.abs(ev.clientX - startX) > 5 || Math.abs(ev.clientY - startY) > 5) {
        moved = true;
      }
    };

    const onMouseUp = (ev: MouseEvent) => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      if (moved) {
        addNote(ev.clientX, ev.clientY);
      } else if (notes.length > 0) {
        setVisible(v => !v);
      }
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [addNote, notes.length]);

  const handleNoteMouseDown = useCallback((noteId: string, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === 'TEXTAREA') return;
    e.preventDefault();
    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const origX = note.x;
    const origY = note.y;

    const onMouseMove = (ev: MouseEvent) => {
      if (note.pinned) {
        updateNotePosition(noteId, origX + (ev.clientX - startX), origY + (ev.clientY - startY));
      } else {
        updateNotePosition(noteId, origX + (ev.clientX - startX), origY + (ev.clientY - startY));
      }
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [notes, updateNotePosition]);

  const handleResizeMouseDown = useCallback((noteId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const origW = note.w;
    const origH = note.h;

    const onMouseMove = (ev: MouseEvent) => {
      const newW = Math.max(MIN_W, origW + (ev.clientX - startX));
      const newH = Math.max(MIN_H, origH + (ev.clientY - startY));
      updateNoteSize(noteId, newW, newH);
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [notes, updateNoteSize]);

  const renderNote = (note: StickyNote) => (
    <div
      key={note.id}
      className={`${styles.note} ${note.pinned ? styles.notePinned : ''}`}
      style={{
        left: note.x,
        top: note.y,
        width: note.w || DEFAULT_W,
        height: note.h || DEFAULT_H,
        backgroundColor: note.color + 'e6',
      }}
      onMouseDown={(e) => handleNoteMouseDown(note.id, e)}
    >
      <div className={styles.noteActions}>
        <button
          className={styles.noteColorBtn}
          onClick={() => cycleColor(note.id)}
          title="换色"
          style={{ backgroundColor: note.color }}
        />
        <button
          className={`${styles.notePinBtn} ${note.pinned ? styles.notePinBtnActive : ''}`}
          onClick={() => togglePin(note.id)}
          title={note.pinned ? '取消固定' : '固定'}
        >
          📌
        </button>
        <button
          className={styles.noteDeleteBtn}
          onClick={() => deleteNote(note.id)}
          title="删除"
        >×</button>
      </div>

      {editingId === note.id ? (
        <textarea
          className={styles.noteTextarea}
          value={editText}
          onChange={e => setEditText(e.target.value)}
          onBlur={() => updateNoteText(note.id, editText)}
          onKeyDown={e => { if (e.key === 'Escape') updateNoteText(note.id, editText); }}
          autoFocus
          placeholder="写点什么..."
        />
      ) : (
        <div
          className={styles.noteText}
          onClick={() => { setEditingId(note.id); setEditText(note.text); }}
        >
          {note.text || '点击编辑...'}
        </div>
      )}

      <div
        className={styles.resizeHandle}
        onMouseDown={(e) => handleResizeMouseDown(note.id, e)}
      />
    </div>
  );

  const floatingNotes = notes.filter(n => !n.pinned);
  const pinnedNotes = notes.filter(n => n.pinned);

  return (
    <>
      {/* Floating notes layer - fixed positioning */}
      <div className={`${styles.notesLayer} ${visible ? '' : styles.notesHidden}`}>
        {floatingNotes.map(renderNote)}
      </div>

      {/* Pinned notes layer - absolute positioning, scrolls with page */}
      <div className={`${styles.pinnedLayer} ${visible ? '' : styles.notesHidden}`}>
        {pinnedNotes.map(renderNote)}
      </div>

      <div
        ref={iconRef}
        className={styles.icon}
        onMouseDown={handleIconMouseDown}
        title="拖拽创建便签 / 点击切换显隐"
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15.5 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z" />
          <path d="M14 3v4a2 2 0 0 0 2 2h4" />
          <path d="M8 13h8M8 17h5" />
        </svg>
        {notes.length > 0 && (
          <span className={styles.badge}>{notes.length}</span>
        )}
      </div>
    </>
  );
}
