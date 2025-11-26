export function TestHtmlWrapper() {
  console.log('TestHtmlWrapper component rendered!');
  
  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0 }}>
      <iframe 
        src="/test.html" 
        style={{ 
          width: '100%', 
          height: '100%', 
          border: 'none',
          margin: 0,
          padding: 0
        }}
        title="Tailwind CSS Test Page"
        onLoad={() => console.log('Test iframe loaded successfully')}
      />
    </div>
  );
}