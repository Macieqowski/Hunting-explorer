import { appendSpeech, webSpeechError } from './speech';

describe('speech helpers', () => {
  it('joins dictated stretches with one space and capitalises new sentences', () => {
    expect(appendSpeech('', 'broń załadowana')).toBe('Broń załadowana');
    expect(appendSpeech('Broń załadowana', ' to broń ')).toBe('Broń załadowana to broń');
    expect(appendSpeech('Pierwsze zdanie. ', 'drugie zdanie')).toBe('Pierwsze zdanie. Drugie zdanie');
    expect(appendSpeech('Wstęp\n', 'dalej')).toBe('Wstęp\nDalej');
    expect(appendSpeech('Bez zmian', '   ')).toBe('Bez zmian');
  });

  it('maps browser errors, ignoring silence and our own stop', () => {
    expect(webSpeechError('no-speech')).toBeNull();
    expect(webSpeechError('aborted')).toBeNull();
    expect(webSpeechError('not-allowed')).toBe('denied');
    expect(webSpeechError('service-not-allowed')).toBe('denied');
    expect(webSpeechError('network')).toBe('network');
    expect(webSpeechError('audio-capture')).toBe('audio');
    expect(webSpeechError('bad-grammar')).toBe('unknown');
  });
});
