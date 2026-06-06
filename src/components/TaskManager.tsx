import { useState, useRef } from 'react';
import type { Task } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { generateId } from '../utils/timeUtils';
import styles from './TaskManager.module.css';

export default function TaskManager() {
  const [tasks, setTasks] = useLocalStorage<Task[]>('chillfocus-tasks', []);
  const [newText, setNewText] = useState('');
  const [newPriority, setNewPriority] = useState<Task['priority']>('medium');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const addTask = () => {
    const text = newText.trim();
    if (!text) return;
    const task: Task = { id: generateId(), text, completed: false, priority: newPriority, createdAt: Date.now() };
    setTasks(prev => [...prev, task]);
    setNewText('');
    inputRef.current?.focus();
  };

  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const startEdit = (task: Task) => {
    setEditingId(task.id);
    setEditText(task.text);
  };

  const saveEdit = () => {
    if (!editingId) return;
    const text = editText.trim();
    if (text) {
      setTasks(prev => prev.map(t => t.id === editingId ? { ...t, text } : t));
    }
    setEditingId(null);
  };

  const cyclePriority = (id: string) => {
    const order: Task['priority'][] = ['medium', 'high', 'low'];
    setTasks(prev => prev.map(t => {
      if (t.id !== id) return t;
      const idx = order.indexOf(t.priority);
      return { ...t, priority: order[(idx + 1) % order.length] };
    }));
  };

  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const pOrder = { high: 0, medium: 1, low: 2 };
    return pOrder[a.priority] - pOrder[b.priority];
  });

  const completedCount = tasks.filter(t => t.completed).length;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          任务列表
        </h3>
        {tasks.length > 0 && (
          <span className={styles.count}>{completedCount}/{tasks.length}</span>
        )}
      </div>

      <div className={styles.addRow}>
        <input
          ref={inputRef}
          className={styles.input}
          type="text"
          placeholder="添加新任务..."
          value={newText}
          onChange={e => setNewText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTask()}
        />
        <button
          className={`${styles.priorityBtn} ${styles[`priority-${newPriority}`]}`}
          onClick={() => {
            const order: Task['priority'][] = ['medium', 'high', 'low'];
            const idx = order.indexOf(newPriority);
            setNewPriority(order[(idx + 1) % order.length]);
          }}
          title="优先级"
        >
          {newPriority === 'high' ? '!!!' : newPriority === 'medium' ? '!!' : '!'}
        </button>
        <button className={styles.addBtn} onClick={addTask}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
        </button>
      </div>

      <ul className={styles.list}>
        {sortedTasks.map(task => (
          <li key={task.id} className={`${styles.item} ${task.completed ? styles.itemDone : ''}`}>
            <button
              className={`${styles.checkbox} ${task.completed ? styles.checked : ''}`}
              onClick={() => toggleTask(task.id)}
            >
              {task.completed && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
              )}
            </button>

            {editingId === task.id ? (
              <input
                className={styles.editInput}
                value={editText}
                onChange={e => setEditText(e.target.value)}
                onBlur={saveEdit}
                onKeyDown={e => e.key === 'Enter' && saveEdit()}
                autoFocus
              />
            ) : (
              <span className={styles.text} onDoubleClick={() => startEdit(task)}>
                {task.text}
              </span>
            )}

            <button
              className={`${styles.priorityDot} ${styles[`priority-${task.priority}`]}`}
              onClick={() => cyclePriority(task.id)}
              title={task.priority}
            />

            <button className={styles.deleteBtn} onClick={() => deleteTask(task.id)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </li>
        ))}
      </ul>

      {tasks.length === 0 && (
        <div className={styles.empty}>暂无任务，添加一个吧 ✨</div>
      )}
    </div>
  );
}
