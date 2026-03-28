/**
 * Known microphone/recorder model names that should be displayed in ALL CAPS.
 * Keys are lowercase for case-insensitive matching; values are the correct display form.
 */
const EQUIPMENT_TAG_MAP: Record<string, string> = {
  // Sennheiser MKH series
  'mkh416': 'MKH416',
  'mkh8060': 'MKH8060',
  'mkh50': 'MKH50',
  'mkh40': 'MKH40',
  'mkh30': 'MKH30',
  'mkh20': 'MKH20',
  'mkh8020': 'MKH8020',
  'mkh8040': 'MKH8040',
  'mkh8050': 'MKH8050',
  'mkh8070': 'MKH8070',
  // Zoom recorders
  'zoomf3': 'ZOOMF3',
  'zoomf6': 'ZOOMF6',
  'zoomf8': 'ZOOMF8',
  'zoomf8n': 'ZOOMF8N',
  'zoomh4n': 'ZOOMH4N',
  'zoomh5': 'ZOOMH5',
  'zoomh6': 'ZOOMH6',
  'zoomh8': 'ZOOMH8',
  // Rode NTG series
  'ntg1': 'NTG1',
  'ntg2': 'NTG2',
  'ntg3': 'NTG3',
  'ntg4': 'NTG4',
  'ntg5': 'NTG5',
  // Rode NT series
  'nt1': 'NT1',
  'nt1a': 'NT1A',
  'nt1-a': 'NT1-A',
  'nt5': 'NT5',
  // Shure SM series
  'sm57': 'SM57',
  'sm58': 'SM58',
  'sm7b': 'SM7B',
  // Audio-Technica
  'at2020': 'AT2020',
  'at4053': 'AT4053',
  'at875r': 'AT875R',
  'at897': 'AT897',
  // DPA
  'dpa4006': 'DPA4006',
  'dpa4011': 'DPA4011',
  'dpa4060': 'DPA4060',
  'dpa4098': 'DPA4098',
  // Tascam DR series
  'dr05': 'DR05',
  'dr05x': 'DR05X',
  'dr40': 'DR40',
  'dr40x': 'DR40X',
  'dr100': 'DR100',
  // Sony PCM series
  'pcmd100': 'PCMD100',
  'pcm-d100': 'PCM-D100',
  // Neumann
  'u87': 'U87',
  'u87ai': 'U87AI',
  'km184': 'KM184',
  'km185': 'KM185',
  // Sanken
  'cs3e': 'CS3E',
  'cs1': 'CS1',
  // Sound Devices
  'mixpre3': 'MIXPRE3',
  'mixpre6': 'MIXPRE6',
  'mixpre10': 'MIXPRE10',
  '633': '633',
  '688': '688',
  '788t': '788T',
};

/**
 * Format tag for display - capitalizes NSFW, equipment model names,
 * and first letter of other tags.
 */
export function formatTagForDisplay(tag: string): string {
  if (!tag) return tag;

  // NSFW should always be uppercase
  if (tag.toLowerCase() === 'nsfw') {
    return 'NSFW';
  }

  // Check if the tag matches a known equipment model name (case-insensitive)
  const equipmentMatch = EQUIPMENT_TAG_MAP[tag.toLowerCase().replace(/[\s-]/g, '').trim()];
  if (equipmentMatch) {
    return equipmentMatch;
  }

  // Also try with original formatting (preserving hyphens) for hyphenated models
  const equipmentMatchWithHyphen = EQUIPMENT_TAG_MAP[tag.toLowerCase().trim()];
  if (equipmentMatchWithHyphen) {
    return equipmentMatchWithHyphen;
  }

  // Default: capitalize first letter of the tag
  return tag.charAt(0).toUpperCase() + tag.slice(1).toLowerCase();
}