async function getSource() {
	var div = document.createElement('div');
	document.body.appendChild(div);
	return new Promise(async (resolve, reject) => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(device => device.kind === "audioinput");

    // Add options for input devices
    for (const input of audioInputs) {
		const selectionButton = document.createElement('button');
		selectionButton.innerText =
		  input.label || `Input Device ${audioInputs.indexOf(input) + 1}`;
		selectionButton.addEventListener('click', async () => {
			const stream = await navigator.mediaDevices.getUserMedia({
  audio: {
    mandatory: {
      // Disable specific processing features
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false, // Not guaranteed to work in all browsers
	  deviceId: input.deviceId
    },
			}});
			resolve(stream);
			document.body.removeChild(div);
		});
		div.appendChild(selectionButton);
    }
  } catch (error) {
    reject("Error getting audio devices:", error);
  }
});
}


async function run() {
  document.body.innerHTML = '';
  const source = await getSource();
  const mediaRecorder = new MediaRecorder(source);
}

go = function() {
  const button = document.createElement('button');
  button.innerHTML = 'GO';
  button.addEventListener('click', run);
  document.body.appendChild(button);
}