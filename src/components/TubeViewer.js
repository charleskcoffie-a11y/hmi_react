import React from 'react';
import '../styles/TubeViewer.css';

export default function TubeViewer({ parameters }) {
  if (!parameters) return null;

  const { tubeID, tubeOD, idFingerRadius, tubeLength } = parameters;
  
  if (!tubeID || !tubeOD) return null;

  // SVG dimensions and scaling for SIDE VIEW
  const svgWidth = 450;
  const svgHeight = 220;
  const scale = 2.5; // pixels per mm - increased for visibility
  const margin = 40;

  // Calculate dimensions in pixels
  const idDiameter = tubeID * scale;
  const odDiameter = tubeOD * scale;
  const fingerRad = (idFingerRadius || 2) * scale;
  const length = Math.min(tubeLength || 100, 120) * scale; // Limit length for display

  // Center vertically
  const centerY = svgHeight / 2;
  const startX = margin;

  // Side view: tube as rectangle with ID and OD walls
  const drawTubeSideView = () => {
    const wallThickness = (odDiameter - idDiameter) / 2;
    
    return (
      <g>
        {/* Outer tube wall (top) */}
        <rect
          x={startX}
          y={centerY - odDiameter / 2}
          width={length}
          height={wallThickness}
          fill="#444"
          stroke="#666"
          strokeWidth="1"
        />
        
        {/* Outer tube wall (bottom) */}
        <rect
          x={startX}
          y={centerY + idDiameter / 2}
          width={length}
          height={wallThickness}
          fill="#444"
          stroke="#666"
          strokeWidth="1"
        />
        
        {/* Inner diameter (hollow space) */}
        <rect
          x={startX}
          y={centerY - idDiameter / 2}
          width={length}
          height={idDiameter}
          fill="rgba(0, 200, 255, 0.1)"
          stroke="#00ccff"
          strokeWidth="1"
          strokeDasharray="4 2"
        />
        
        {/* ID Finger visualization (small circle on left end) */}
        <circle
          cx={startX + 10}
          cy={centerY}
          r={fingerRad}
          fill="#ff6b6b"
          stroke="#ff4444"
          strokeWidth="1.5"
        />
        
        {/* Dimension lines and labels */}
        {/* OD dimension */}
        <line
          x1={startX + length + 10}
          y1={centerY - odDiameter / 2}
          x2={startX + length + 10}
          y2={centerY + odDiameter / 2}
          stroke="#00ff00"
          strokeWidth="1.5"
        />
        <text
          x={startX + length + 20}
          y={centerY}
          fill="#00ff00"
          fontSize="12"
          fontWeight="bold"
        >
          OD: {tubeOD}mm
        </text>
        
        {/* ID dimension */}
        <line
          x1={startX + length + 15}
          y1={centerY - idDiameter / 2}
          x2={startX + length + 15}
          y2={centerY + idDiameter / 2}
          stroke="#00ccff"
          strokeWidth="1.5"
          strokeDasharray="2 2"
        />
        <text
          x={startX + length + 20}
          y={centerY + 20}
          fill="#00ccff"
          fontSize="11"
        >
          ID: {tubeID}mm
        </text>
        
        {/* Length dimension */}
        <line
          x1={startX}
          y1={centerY - odDiameter / 2 - 15}
          x2={startX + length}
          y2={centerY - odDiameter / 2 - 15}
          stroke="#ffaa00"
          strokeWidth="1.5"
        />
        <text
          x={startX + length / 2 - 30}
          y={centerY - odDiameter / 2 - 20}
          fill="#ffaa00"
          fontSize="11"
          fontWeight="bold"
        >
          Length: {tubeLength}mm
        </text>
      </g>
    );
  };

  return (
    <div className="tube-viewer">
      <h3>Tube Cross-Section (Side View)</h3>
      <svg width={svgWidth} height={svgHeight} className="tube-svg">
        {drawTubeSideView()}
      </svg>
    </div>
  );
}
