import { useState, useRef, useCallback, useEffect } from 'react';
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
  const [creating, setCreating] = useState(false);
  const iconRef = useRef<HTMLDivElement>(null);

  const addNote = useCallback((x: number, y: number) => {
    const note: StickyNote = {
      id: generateId(),
      text: '',
      x, y,
      w: DEFAULT_W,
      h: DEFAULT_H,
      color: NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)],
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

  const handleIconDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', 'create-note');
    e.dataTransfer.effectAllowed = 'copy';
    setCreating(true);
  }, []);

  const handleGlobalDrop = useCallback((e: DragEvent) => {
    if (e.dataTransfer?.getData('text/plain') !== 'create-note') return;
    e.preventDefault();
    addNote(e.clientX, e.clientY);
    setCreating(false);
  }, [addNote]);

  const handleGlobalDragOver = useCallback((e: DragEvent) => {
    if (creating) e.preventDefault();
  }, [creating]);

  useEffect(() => {
    document.addEventListener('drop', handleGlobalDrop);
    document.addEventListener('dragover', handleGlobalDragOver);
    return () => {
      document.removeEventListener('drop', handleGlobalDrop);
      document.removeEventListener('dragover', handleGlobalDragOver);
    };
  }, [handleGlobalDrop, handleGlobalDragOver]);

  const handleIconClick = useCallback(() => {
    if (notes.length > 0) setVisible(v => !v);
  }, [notes.length]);

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
      updateNotePosition(noteId, origX + (ev.clientX - startX), origY + (ev.clientY - startY));
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

  return (
    <>
      <div className={`${styles.notesLayer} ${visible ? '' : styles.notesHidden}`}>
        {notes.map(note => (
          <div
            key={note.id}
            className={styles.note}
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
        ))}
      </div>

      <div
        ref={iconRef}
        className={styles.icon}
        draggable
        onDragStart={handleIconDragStart}
        onClick={handleIconClick}
        title={notes.length > 0 ? (visible ? '点击隐藏便签' : '点击显示便签') : '拖拽到任意位置创建便签'}
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
