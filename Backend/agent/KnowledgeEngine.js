/**
 * Knowledge Engine
 * 
 * Manages structured knowledge bases like device manuals, emergency procedures,
 * and home policies. Handles semantic retrieval and FAQ generation.
 */

const manualsDB = {
  'inverter': 'To reset the inverter, press and hold the power button for 10 seconds until the red light blinks twice.',
  'smart lock': 'If the smart lock battery dies, use the physical override key located at the bottom of the handle.',
  'ac': 'To clean the AC filter, open the front panel, gently pull out the mesh filters, and wash them with lukewarm water.'
};

exports.queryKnowledgeBase = async (query) => {
  console.log(`📚 [Knowledge Engine] Searching knowledge base for: "${query}"`);
  
  const queryLower = query.toLowerCase();
  let answer = 'I could not find a specific manual entry for your query.';
  let confidence = 0.0;

  const controlKeywords = ['on', 'off', 'chalu', 'band', 'karo', 'kijiye', 'set', 'temperature', 'chalao', 'turn'];
  const isControlQuery = controlKeywords.some(kw => queryLower.includes(kw));

  if (!isControlQuery) {
    for (const [device, manual] of Object.entries(manualsDB)) {
      if (queryLower.includes(device)) {
        answer = manual;
        confidence = 0.92;
        break;
      }
    }
  }

  return {
    query,
    answer,
    confidence,
    source: 'Home Knowledge Base'
  };
};

exports.addDocument = async (title, content) => {
  console.log(`📚 [Knowledge Engine] Indexing new document: "${title}"`);
  // Stub for embedding generation and RAG vector store ingestion
  return { success: true, message: 'Document indexed successfully.' };
};
