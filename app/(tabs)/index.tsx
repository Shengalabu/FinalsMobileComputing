import { Ionicons } from '@expo/vector-icons';
import * as SQLite from 'expo-sqlite';
import React, { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';

let db: SQLite.SQLiteDatabase | null = null;

const setupDatabase = async () => {
  db = await SQLite.openDatabaseAsync('streaks.db');
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS streaks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      count INTEGER,
      last_updated TEXT,
      alive INTEGER,
      "order" INTEGER
    );
  `);
  await db.execAsync('ALTER TABLE streaks ADD COLUMN "order" INTEGER;').catch(() => {});
};

export default function App() {
  const [text, setText] = useState('');
  const [streaks, setStreaks] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [newStreakText, setNewStreakText] = useState('');

  useEffect(() => {
    setupDatabase().then(() => {
      checkStreakStatus().then(fetchStreaks);
    });
  }, []);

  const today = new Date().toISOString().split('T')[0];

  const fetchStreaks = async () => {
    if (!db) return;
    const results = await db.getAllAsync<any>('SELECT * FROM streaks ORDER BY "order" ASC, id DESC;');
    setStreaks(results);
  };

  const checkStreakStatus = async () => {
    if (!db) return;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yDate = yesterday.toISOString().split('T')[0];

    await db.runAsync(
      `UPDATE streaks SET alive = 0 WHERE last_updated < ? AND alive = 1;`,
      [today]
    );
  };

  const getNextOrder = async () => {
    if (!db) return 0;
    const res = await db.getFirstAsync<any>('SELECT MAX("order") as maxOrder FROM streaks;');
    return (res?.maxOrder ?? 0) + 1;
  };

  const addStreak = async () => {
    if (!db || !text.trim()) return;
    const nextOrder = await getNextOrder();
    await db.runAsync(
      'INSERT INTO streaks (name, count, last_updated, alive, "order") VALUES (?, ?, ?, ?, ?);',
      [text.trim(), 0, '', 1, nextOrder]
    );
    setText('');
    fetchStreaks();
  };

  const handleAddStreak = async () => {
    if (!db || !newStreakText.trim()) return;
    const nextOrder = await getNextOrder();
    await db.runAsync(
      'INSERT INTO streaks (name, count, last_updated, alive, "order") VALUES (?, ?, ?, ?, ?);',
      [newStreakText.trim(), 0, '', 1, nextOrder]
    );
    setNewStreakText('');
    setModalVisible(false);
    fetchStreaks();
  };

  const continueStreak = async (id: number, last_updated: string, count: number) => {
    if (!db) return;
    if (last_updated === today) {
      Alert.alert('Already continued today!');
      return;
    }
    await db.runAsync(
      'UPDATE streaks SET count = ?, last_updated = ? WHERE id = ?;',
      [count + 1, today, id]
    );
    fetchStreaks();
  };

  const cancelTodayInput = async (id: number, last_updated: string, count: number) => {
    if (!db || last_updated !== today) return;
    await db.runAsync(
      'UPDATE streaks SET count = ?, last_updated = ? WHERE id = ?;',
      [count - 1, '', id]
    );
    fetchStreaks();
  };

  const deleteStreak = async (id: number) => {
    if (!db) return;
    await db.runAsync('DELETE FROM streaks WHERE id = ?;', [id]);
    fetchStreaks();
  };

  const editStreak = (id: number, name: string) => {
    setEditingId(id);
    setEditingText(name);
  };

  const saveEditStreak = async () => {
    if (editingId !== null && db && editingText.trim()) {
      await db.runAsync('UPDATE streaks SET name = ? WHERE id = ?;', [editingText.trim(), editingId]);
      setEditingId(null);
      setEditingText('');
      fetchStreaks();
    }
  };

  const cancelEditStreak = () => {
    setEditingId(null);
    setEditingText('');
  };

  const updateStreakOrder = async (data: any[]) => {
    if (!db) return;
    for (let i = 0; i < data.length; i++) {
      await db.runAsync('UPDATE streaks SET "order" = ? WHERE id = ?;', [i, data[i].id]);
    }
    fetchStreaks();
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Streaks</Text>
        {streaks.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>It looks empty here, go and add a new streak!</Text>
          </View>
        )}
        <DraggableFlatList
          data={streaks}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={{ paddingBottom: 40 }}
          onDragEnd={({ data }) => {
            setStreaks(data);
            updateStreakOrder(data);
          }}
          renderItem={({ item, drag, isActive }: RenderItemParams<any>) => (
            editingId === item.id ? (
              <View style={[styles.streakCard, item.last_updated === today
                ? styles.updatedTodayCard
                : item.alive
                ? styles.aliveCard
                : styles.deadCard]}
              >
                <TextInput
                  value={editingText}
                  onChangeText={setEditingText}
                  style={[styles.textInput, { fontSize: 20, marginBottom: 10 }]}
                  autoFocus
                />
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                  <TouchableOpacity onPress={saveEditStreak} style={[styles.addButton, { marginRight: 8 }]}> 
                    <Ionicons name="checkmark" size={22} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={cancelEditStreak} style={styles.cancelButton}>
                    <Ionicons name="close" size={22} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View
                style={[
                  styles.streakCard,
                  item.last_updated === today
                    ? styles.updatedTodayCard
                    : item.alive
                    ? styles.aliveCard
                    : styles.deadCard,
                  isActive && { opacity: 0.7 },
                  { flexDirection: 'column', alignItems: 'stretch', position: 'relative' },
                ]}
              >
                {/* Card content */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => {
                    if (item.last_updated === today) {
                      cancelTodayInput(item.id, item.last_updated, item.count);
                    } else {
                      continueStreak(item.id, item.last_updated, item.count);
                    }
                  }}
                  style={{ flex: 1 }}
                >
                  <View style={styles.streakHeaderRow}>
                    <View style={styles.streakDayCountRow}>
                      <Text style={styles.streakFireIcon}>
                        {item.last_updated === today ? '🔥' : '🧊'}
                      </Text>
                      <Text style={[
                        styles.streakDayCount,
                        item.last_updated === today && { color: '#ff9800' },
                      ]}>
                        {item.count}
                      </Text>
                      <Text style={[
                        styles.streakDayLabel,
                        item.last_updated === today && { color: '#ff9800' },
                      ]}> {item.count === 1 ? 'DAY' : 'DAYS'}</Text>
                    </View>
                    <TouchableOpacity onPress={() => editStreak(item.id, item.name)}>
                      <Ionicons name="pencil" size={22} color="#444" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.streakName}>{item.name}</Text>
                  <View style={styles.streakFooterRow}>
                    <View style={{ flex: 1 }} />
                    <TouchableOpacity onPress={() => deleteStreak(item.id)}>
                      <Ionicons name="trash" size={22} color="#444" />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
                {/* Absolutely positioned drag handle at bottom left, does not affect layout */}
                <View style={{ position: 'absolute', left: 8, bottom: 8, zIndex: 10 }} pointerEvents="box-none">
                  <TouchableOpacity
                    onLongPress={drag}
                    onPressIn={drag}
                    delayLongPress={100}
                    style={{ justifyContent: 'center', alignItems: 'center', height: 24, width: 18, opacity: 0.3 }}
                    hitSlop={{ left: 8, right: 8, top: 8, bottom: 8 }}
                  >
                    <Ionicons name="reorder-two" size={18} color="#aaa" style={{ transform: [{ rotate: '90deg' }] }} />
                  </TouchableOpacity>
                </View>
              </View>
            )
          )}
        />
      </ScrollView>
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalVisible(true)}
        activeOpacity={1}
      >
        <Ionicons name="add" size={36} color="#fff" />
      </TouchableOpacity>
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.title}>Add New Streak</Text>
            <TextInput
              placeholder="New Streak Name"
              value={newStreakText}
              onChangeText={setNewStreakText}
              style={styles.textInput}
              placeholderTextColor="#aaa"
              autoFocus
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 }}>
              <TouchableOpacity onPress={handleAddStreak} style={[styles.addButton, { marginRight: 8 }]}> 
                <Ionicons name="checkmark" size={22} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.cancelButton}>
                <Ionicons name="close" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f4f6fb',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#222',
    letterSpacing: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#f0f2f7',
    marginRight: 8,
    borderWidth: 0,
  },
  addButton: {
    backgroundColor: '#4f8cff',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  streakCard: {
    borderWidth: 0,
    marginVertical: 7,
    padding: 18,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  streakHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 0,
  },
  streakDayCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  streakFireIcon: {
    fontSize: 32,
    marginRight: 0,
    marginTop: -5,
  },
  streakDayCount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#888',
    letterSpacing: 1,
    marginRight: 0, 
  },
  streakDayLabel: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#888',
    marginLeft: -5, 
    letterSpacing: 1,
  },
  streakName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#444',
    marginBottom: 0,
    marginLeft: 8,
  },
  streakFooterRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    flex: 1,
    marginTop: 32,
  },
  deadText: {
    color: '#b71c1c',
  },
  aliveText: {
    color: '#2e7d5b',
  },
  deadCard: {
    backgroundColor: '#696969',
  },
  aliveCard: {
    backgroundColor: '#c4efff',
  },
  updatedTodayCard: {
    backgroundColor: '#fce0b8', // pastel green
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 2,
    marginBottom: 8,
  },
  continueButton: {
    backgroundColor: '#4f8cff',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: 8,
  },
  cancelButton: {
    backgroundColor: '#f0ad4e',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  editDeleteRow: {
    flexDirection: 'row',
    marginTop: 2,
  },
  editText: {
    color: '#4f8cff',
    fontWeight: 'bold',
    fontSize: 15,
    marginRight: 16,
  },
  deleteText: {
    color: '#b71c1c',
    fontWeight: 'bold',
    fontSize: 15,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 32,
    backgroundColor: '#fcc072', 
    borderRadius: 32,
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 24,
    alignItems: 'stretch',
    elevation: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
    marginBottom: 40,
  },
  emptyText: {
    fontSize: 15,
    color: '#222',
    opacity: 0.4,
    textAlign: 'center',
    fontWeight: '600',
  },
});
