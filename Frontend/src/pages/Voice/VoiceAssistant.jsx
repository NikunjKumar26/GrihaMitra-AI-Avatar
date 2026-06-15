import React, { useState, useEffect, useRef } from 'react';
import nlp from 'compromise';
import stringSimilarity from 'string-similarity';


const VoiceAssistant = ({ homeInfo, toggleDevice }) => {
  const [isActive, setIsActive] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  
  // Refs for access inside closures without re-triggering useEffect
  const stateRef = useRef({ homeInfo, toggleDevice });
  const recognitionRef = useRef(null);
  
  useEffect(() => {
    stateRef.current = { homeInfo, toggleDevice };
  }, [homeInfo, toggleDevice]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e) {}
      }
    };
  }, []);

  const normalize = (text) => {
     let cleanText = text.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "").trim();
     
     // Homophone replacements for numbers and common misrecognitions
     const homophones = {
       "for": "4", "four": "4",
       "to": "2", "too": "2", "two": "2",
       "won": "1", "one": "1",
       "free": "3", "tree": "3", "three": "3",
       "ate": "8", "eight": "8",
       "five": "5", "six": "6", "seven": "7", "nine": "9", "ten": "10"
     };
     
     let words = cleanText.split(' ');
     words = words.map(w => homophones[w] || w);
     cleanText = words.join(' ');

     try {
       const doc = nlp(cleanText);
       doc.contractions().expand();
       doc.numbers().toNumber();
       return doc.text();
     } catch (e) {
       return cleanText;
     }
  };

  const getIntent = (text) => {
     if (text.includes('turn on') || text.includes('switch on') || text.includes('start')) return true;
     if (text.includes('turn off') || text.includes('switch off') || text.includes('stop')) return false;

     const onKeywords = ['on', 'start', 'activate', 'run', 'enable', 'open'];
     const offKeywords = ['off', 'stop', 'deactivate', 'close', 'disable', 'shut'];
     
     const words = text.split(' ');
     for (const word of words) {
        if (onKeywords.includes(word)) return true;
        if (offKeywords.includes(word)) return false;
     }

     let highestOn = 0;
     let highestOff = 0;

     for (const word of words) {
        const onMatch = stringSimilarity.findBestMatch(word, onKeywords);
        const offMatch = stringSimilarity.findBestMatch(word, offKeywords);
        if (onMatch.bestMatch.rating > highestOn) highestOn = onMatch.bestMatch.rating;
        if (offMatch.bestMatch.rating > highestOff) highestOff = offMatch.bestMatch.rating;
     }

     if (highestOn > 0.65 && highestOn > highestOff) return true;
     if (highestOff > 0.65 && highestOff > highestOn) return false;

     return null;
  };

  const findBestMatch = (target, candidates, threshold = 0.45) => {
     if (!candidates || candidates.length === 0) return null;
     
     // 1. Exact substring match (highest priority)
     for (const candidate of candidates) {
        if (target.includes(candidate.name.toLowerCase())) {
           return candidate;
        }
     }
     
     const targetTokens = target.split(' ');
     const candidateNames = candidates.map(c => c.name.toLowerCase());
     
     // 2. Full phrase fuzzy match
     const fullMatch = stringSimilarity.findBestMatch(target, candidateNames);
     if (fullMatch.bestMatch.rating > 0.65) {
        return candidates[fullMatch.bestMatchIndex];
     }

     // 3. Token-level and Bigram-level fuzzy match (handles short names in long sentences)
     let bestTokenMatch = null;
     let highestRating = 0;
     const stopWords = ['the', 'in', 'on', 'off', 'of', 'and', 'room', 'turn', 'switch', 'start', 'stop', 'please'];

     for (const candidate of candidates) {
         const cName = candidate.name.toLowerCase();
         const cTokens = cName.split(' ');

         // Partial exact word match (e.g. "fan" inside "ceiling fan")
         let matchedWords = 0;
         for (const token of targetTokens) {
             if (token.length > 2 && !stopWords.includes(token) && cTokens.includes(token)) {
                 matchedWords++;
             }
         }
         if (matchedWords > 0) {
             const rating = 0.7 + (matchedWords * 0.1);
             if (rating > highestRating) {
                 highestRating = rating;
                 bestTokenMatch = candidate;
             }
         }

         // Single token
         for (const token of targetTokens) {
             const rating = stringSimilarity.compareTwoStrings(token, cName);
             if (rating > highestRating) {
                 highestRating = rating;
                 bestTokenMatch = candidate;
             }
         }
         // Bigram (two consecutive tokens)
         for (let i = 0; i < targetTokens.length - 1; i++) {
             const combined = `${targetTokens[i]} ${targetTokens[i+1]}`;
             const rating = stringSimilarity.compareTwoStrings(combined, cName);
             if (rating > highestRating) {
                 highestRating = rating;
                 bestTokenMatch = candidate;
             }
         }
     }

     if (highestRating >= threshold) {
         return bestTokenMatch;
     }

     return null;
  };

  const processOfflineAI = (text, hi, td) => {
     if(!hi || !hi.rooms) {
       setFeedbackText('Home configuration not loaded.');
       setTimeout(() => setFeedbackText(''), 3000);
       return;
     }

     const normalizedText = normalize(text);

     const action = getIntent(normalizedText);
     
     if (action === null) {
       setFeedbackText(`Could not detect "on" or "off" in: "${text}"`);
       setTimeout(() => setFeedbackText(''), 4000);
       return;
     }

     const matchedRoom = findBestMatch(normalizedText, hi.rooms, 0.45);

     if (!matchedRoom) {
       setFeedbackText(`Which room? (Command: "${text}")`);
       setTimeout(() => setFeedbackText(''), 4000);
       return;
     }

     const matchedDevice = findBestMatch(normalizedText, matchedRoom.devices, 0.45);

     if (!matchedDevice) {
       setFeedbackText(`Device not found in ${matchedRoom.name}.`);
       setTimeout(() => setFeedbackText(''), 4000);
       return;
     }

     if (matchedDevice.isOn !== action) {
       td(matchedRoom._id, matchedDevice._id, matchedDevice.isOn);
       setFeedbackText(`Turning ${action ? 'ON' : 'OFF'} ${matchedDevice.name} in ${matchedRoom.name}`);
     } else {
       setFeedbackText(`${matchedDevice.name} is already ${action ? 'ON' : 'OFF'}`);
     }
     
     setTimeout(() => setFeedbackText(''), 4000);
  };

  const handleManualActivate = () => {
     if (isActive) {
        // Stop listening manually if clicked again
        if (recognitionRef.current) {
           try { recognitionRef.current.stop(); } catch(e) {}
        }
        setIsActive(false);
        setFeedbackText('');
        return;
     }

     const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
     if (!SpeechRecognition) {
       setFeedbackText("Speech Recognition not supported in this browser.");
       setTimeout(() => setFeedbackText(''), 4000);
       return;
     }

     setIsActive(true);
     setFeedbackText('Listening for command...');

     const recognition = new SpeechRecognition();
     recognition.continuous = false; // Only listen for a single command, no background listening
     recognition.interimResults = true; // Stream words in real-time!
     recognition.lang = 'en-IN';

     recognition.onresult = (event) => {
       let interimStr = '';
       let finalStr = '';

       for (let i = event.resultIndex; i < event.results.length; ++i) {
         if (event.results[i].isFinal) {
           finalStr += event.results[i][0].transcript;
         } else {
           interimStr += event.results[i][0].transcript;
         }
       }

       if (interimStr) {
         setFeedbackText(interimStr.toLowerCase().trim() + '...');
       }

       if (finalStr) {
         const transcript = finalStr.toLowerCase().trim();
         console.log('Voice Detected Full Command:', transcript);
         setFeedbackText(transcript);
         
         const { homeInfo: hi, toggleDevice: td } = stateRef.current;
         processOfflineAI(transcript, hi, td);
         setIsActive(false);
       }
     };

     recognition.onerror = (event) => {
         console.error('Speech recognition error', event.error);
         if (event.error !== 'no-speech') {
             setFeedbackText(`Microphone error: ${event.error}`);
             setTimeout(() => setFeedbackText(''), 3000);
         } else {
             setFeedbackText('');
         }
         setIsActive(false);
     };

     recognition.onend = () => {
       setIsActive(false);
     };

     try {
       recognition.start();
       recognitionRef.current = recognition;
     } catch (e) {
       console.error(e);
       setIsActive(false);
       setFeedbackText('Failed to start microphone.');
       setTimeout(() => setFeedbackText(''), 3000);
     }
  };

  return (
    <div style={{ position: 'fixed', bottom: '30px', right: '30px', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
       {feedbackText && (
         <div className="fade-in" style={{ background: 'rgba(0,0,0,0.85)', color: '#FFF', padding: '12px 18px', borderRadius: '12px', border: '1px solid var(--accent-yellow)', backdropFilter: 'blur(10px)', fontSize: '0.95rem', maxWidth: '280px', wordWrap: 'break-word', boxShadow: '0 4px 20px rgba(0,0,0,0.6)', fontWeight: 500, textAlign: 'right' }}>
           <span style={{ color: 'var(--accent-yellow)', fontWeight: 'bold' }}>Voice: </span>
           "{feedbackText}"
         </div>
       )}
       <button 
         onClick={handleManualActivate}
         title="Voice Command"
         style={{ 
           width: '64px', height: '64px', borderRadius: '50%', background: isActive ? 'var(--accent-yellow)' : 'rgba(15,15,15,0.95)', color: isActive ? '#000' : 'var(--accent-yellow)', border: isActive ? 'none' : '2px solid var(--accent-yellow)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: isActive ? '0 0 25px var(--accent-yellow)' : '0 10px 25px rgba(0,0,0,0.8)', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
         }}
       >
          <svg width="28" height="28" viewBox="0 0 24 24" fill={isActive ? '#000' : 'transparent'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
            <line x1="12" y1="19" x2="12" y2="23"></line>
            <line x1="8" y1="23" x2="16" y2="23"></line>
          </svg>
       </button>
    </div>
  );
};

export default VoiceAssistant;
