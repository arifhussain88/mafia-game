import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { legalDocuments, type LegalDocumentId } from '../content/legal';

type LegalDocumentScreenProps = {
  documentId: LegalDocumentId | null;
  onClose: () => void;
};

export function LegalDocumentScreen({ documentId, onClose }: LegalDocumentScreenProps) {
  const document = documentId ? legalDocuments[documentId] : null;

  return (
    <Modal visible={document !== null} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.title}>{document?.title}</Text>
          <Pressable onPress={onClose} style={styles.closeButton} accessibilityRole="button">
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.body}>
          {document?.sections.map((section, index) => (
            <View key={`${section.heading ?? 'section'}-${index}`} style={styles.section}>
              {section.heading ? <Text style={styles.heading}>{section.heading}</Text> : null}
              {section.paragraphs?.map((paragraph) => (
                <Text key={paragraph} style={styles.paragraph}>{paragraph}</Text>
              ))}
              {section.bullets?.map((bullet) => (
                <Text key={bullet} style={styles.bullet}>{`\u2022 ${bullet}`}</Text>
              ))}
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f6f3ee' },
  header: {
    paddingTop: 54,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e7e0d6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: { color: '#1c1917', fontSize: 22, fontWeight: '800', flex: 1 },
  closeButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#9a3412' },
  closeText: { color: '#fff', fontWeight: '700' },
  body: { paddingHorizontal: 20, paddingVertical: 18, paddingBottom: 48 },
  section: { marginBottom: 16 },
  heading: { color: '#1c1917', fontSize: 17, fontWeight: '800', marginBottom: 6 },
  paragraph: { color: '#292524', fontSize: 15, lineHeight: 22, marginBottom: 8 },
  bullet: { color: '#292524', fontSize: 15, lineHeight: 22, marginBottom: 6, paddingLeft: 4 },
});
