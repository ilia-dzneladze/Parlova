/**
 * TEMPORARY DEBUG COMPONENT — delete this file when done.
 *
 * Reads the local SQLite file and uploads it to the backend so you can
 * open it in DB Browser for SQLite on your machine.
 *
 * Usage: render <SendDBButton /> anywhere in the app, tap it once,
 * then run `python debug_receive_db.py` on the backend to save the file.
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

// Same API_BASE as Chat.tsx — update if your ngrok URL changed
const API_BASE = 'https://overabusive-nonchimerically-marvella.ngrok-free.dev';

const DB_PATH = FileSystem.documentDirectory + 'SQLite/parlova.db';

export default function SendDBButton() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');

  async function send() {
    setStatus('sending');
    try {
      const info = await FileSystem.getInfoAsync(DB_PATH);
      if (!info.exists) {
        Alert.alert('Not found', `No file at:\n${DB_PATH}`);
        setStatus('error');
        return;
      }

      const result = await FileSystem.uploadAsync(
        `${API_BASE}/debug/upload-db`,
        DB_PATH,
        {
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          fieldName: 'file',
        }
      );

      if (result.status === 200) {
        setStatus('done');
        Alert.alert('Done', 'parlova.db saved on the backend.\nOpen it with DB Browser for SQLite.');
      } else {
        throw new Error(`HTTP ${result.status}`);
      }
    } catch (e: any) {
      setStatus('error');
      Alert.alert('Error', e.message);
    }
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, status === 'done' && styles.done, status === 'error' && styles.error]}
        onPress={send}
        disabled={status === 'sending'}
      >
        {status === 'sending'
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.label}>
              {status === 'done' ? '✓ DB sent' : status === 'error' ? '✗ Error' : '📤 Send DB to backend'}
            </Text>
        }
      </TouchableOpacity>
      {status === 'idle' && (
        <Text style={styles.hint}>Saves parlova.db on your dev machine</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', padding: 16 },
  button: {
    backgroundColor: '#555',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    minWidth: 200,
    alignItems: 'center',
  },
  done:  { backgroundColor: '#2a7a2a' },
  error: { backgroundColor: '#8b0000' },
  label: { color: '#fff', fontSize: 15, fontWeight: '600' },
  hint:  { color: '#888', fontSize: 12, marginTop: 6 },
});
