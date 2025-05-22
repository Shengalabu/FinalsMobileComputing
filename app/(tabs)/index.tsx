import * as SQLite from 'expo-sqlite';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Text, TextInput, TouchableOpacity, View } from 'react-native';

let db: SQLite.SQLiteDatabase | null = null;

const setupDatabase = async () => {
  db = await SQLite.openDatabaseAsync('streaks.db');
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS streaks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      count INTEGER,
      last_updated TEXT,
      alive INTEGER
    );
  `);
};

export default function App() {
  const [text, setText] = useState('');
  const [streaks, setStreaks] = useState<any[]>([]);

  useEffect(() => {
    setupDatabase().then(() => {
      checkStreakStatus().then(fetchStreaks);
    });
  }, []);

  const today = new Date().toISOString().split('T')[0];

  const fetchStreaks = async () => {
    if (!db) return;
    const results = await db.getAllAsync<any>('SELECT * FROM streaks;');
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

  const addStreak = async () => {
    if (!db || !text.trim()) return;
    await db.runAsync(
      'INSERT INTO streaks (name, count, last_updated, alive) VALUES (?, ?, ?, ?);',
      [text.trim(), 0, '', 1]
    );
    setText('');
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

  const editStreak = async (id: number) => {
    const newName = prompt('Enter new name');
    if (newName && db) {
      await db.runAsync('UPDATE streaks SET name = ? WHERE id = ?;', [newName, id]);
      fetchStreaks();
    }
  };

  return (
    <View style={{ flex: 1, padding: 20, backgroundColor: '#f4f6fb' }}>
      <Text style={{ fontSize: 28, fontWeight: 'bold', marginBottom: 20, color: '#222', letterSpacing: 1 }}>Streaks</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 }}>
        <TextInput
          placeholder="New Streak Name"
          value={text}
          onChangeText={setText}
          style={{ flex: 1, fontSize: 16, padding: 10, borderRadius: 10, backgroundColor: '#f0f2f7', marginRight: 8, borderWidth: 0 }}
          placeholderTextColor="#aaa"
        />
        <TouchableOpacity onPress={addStreak} style={{ backgroundColor: '#4f8cff', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16 }}>
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Add</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={streaks}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <View
            style={{
              borderWidth: 0,
              marginVertical: 7,
              padding: 18,
              borderRadius: 18,
              backgroundColor: item.alive ? '#e6f7ee' : '#fbeaea',
              shadowColor: '#000',
              shadowOpacity: 0.07,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            <Text style={{ fontSize: 20, fontWeight: '600', color: item.alive ? '#2e7d5b' : '#b71c1c', marginBottom: 6 }}>
              {item.name}
            </Text>
            <Text style={{ fontSize: 15, color: '#555', marginBottom: 10 }}>
              {item.count} day(s) {item.alive ? '' : <Text style={{ color: '#b71c1c' }}>(Dead)</Text>}
            </Text>
            {item.alive && (
              <View style={{ flexDirection: 'row', marginTop: 2, marginBottom: 8 }}>
                <TouchableOpacity onPress={() => continueStreak(item.id, item.last_updated, item.count)} style={{ backgroundColor: '#4f8cff', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14, marginRight: 8 }}>
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>Continue</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => cancelTodayInput(item.id, item.last_updated, item.count)} style={{ backgroundColor: '#f0ad4e', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 }}>
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>Cancel Today</Text>
                </TouchableOpacity>
              </View>
            )}
            <View style={{ flexDirection: 'row', marginTop: 2 }}>
              <TouchableOpacity onPress={() => editStreak(item.id)} style={{ marginRight: 16 }}>
                <Text style={{ color: '#4f8cff', fontWeight: 'bold', fontSize: 15 }}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteStreak(item.id)}>
                <Text style={{ color: '#b71c1c', fontWeight: 'bold', fontSize: 15 }}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  );
}
