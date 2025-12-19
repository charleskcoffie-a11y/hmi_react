
/**
 * Beckhoff TwinCAT 3 ADS Communication Service
 * Handles all communication with PLC for program data
 * 
 * Installation: npm install @beckhoff/ads
 */


import { AdsClient } from 'ads-client';
const adsClient = new AdsClient();

const PLC_CONFIG = {
	TARGET_IP: '169.254.109.230.1.1', // Provided NetID
	ADS_PORT: 851, // Provided port
	TIMEOUT: 5000,
};

const getActualPositionSymbols = (side) => {
	if (side === 'right') {
		return {
			axis1: 'PlcState.lAxis1ActPos',
			axis2: 'PlcState.lAxis2ActPos'
		};
	}
	return {
		axis1: 'PlcState.lAxis3ActPos',
		axis2: 'PlcState.lAxis4ActPos'
	};
};

const getPatternArrayName = (side) => side === 'right' ? 'PlcState.aSeqRStep' : 'PlcState.aSeqLStep';

const getSequenceVariableName = (side, stepNum) => {
	const prefix = side === 'right' ? 'iSeqR' : 'iSeqL';
	return `PlcState.${prefix}Step${stepNum}`;
};

const getSideStateSymbols = (side) => {
	if (side === 'right') {
		return { state: 'Rstate', desc: 'RstateDesc' };
	}
	return { state: 'Lstate', desc: 'LstateDesc' };
};


export const sendProgramToPLC = async (programData) => {
	try {
		console.log('Connecting to PLC:', PLC_CONFIG.TARGET_IP);
		await adsClient.connect({
			targetAmsNetId: PLC_CONFIG.TARGET_IP,
			targetAdsPort: PLC_CONFIG.ADS_PORT,
			timeout: PLC_CONFIG.TIMEOUT
		});

		const side = programData.side === 'right' ? 'Right' : 'Left';
		const results = [];

		for (let stepNum = 1; stepNum <= 10; stepNum++) {
			// Example: Write a value to a PLC variable
			// You must adapt this to your actual programData structure and PLC variable names
			const symbolName = `PlcState.l${side}PosStep${stepNum}`;
			const value = programData.steps?.[stepNum]?.positions || { axis1Cmd: 0, axis2Cmd: 0 };
			await adsClient.writeSymbol(symbolName, [value.axis1Cmd, value.axis2Cmd, 0, 0]);
			results.push({ step: stepNum, symbol: symbolName, value });
		}

		await adsClient.disconnect();
		return results;
	} catch (error) {
		console.error('Failed to send program to PLC:', error);
		throw new Error(`PLC communication error: ${error.message}`);
	}
};


export const readSequenceCounter = async (side, stepNum) => {
	try {
		const seqVarName = getSequenceVariableName(side, stepNum);
		await adsClient.connect({
			targetAmsNetId: PLC_CONFIG.TARGET_IP,
			targetAdsPort: PLC_CONFIG.ADS_PORT,
			timeout: PLC_CONFIG.TIMEOUT
		});
		const value = await adsClient.readSymbol(seqVarName);
		await adsClient.disconnect();
		return value;
	} catch (error) {
		throw new Error(`PLC read error: ${error.message}`);
	}
};
