class VoiceProcessor extends AudioWorkletProcessor {
    process(inputs, outputs, parameters) {
        const input = inputs[0];
        if (input.length > 0) {
            const inputData = input[0];
            const buffer = new ArrayBuffer(inputData.length * 4);
            const view = new Float32Array(buffer);
            view.set(inputData);

            this.port.postMessage({
                type: "audioData",
                data: buffer,
            });
        }
        return true;
    }
}

registerProcessor("voice-processor", VoiceProcessor);
