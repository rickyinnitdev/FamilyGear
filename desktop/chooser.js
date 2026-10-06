window.familyGear.onDevices(devices => {
  const container = document.getElementById('devices'); container.replaceChildren();
  if (!devices.length) container.textContent = 'No matching device yet. Connect your device to continue.';
  for (const device of devices) {
    const button = document.createElement('button');
    button.textContent = `${device.name || 'USB device'} · ${device.vendorId.toString(16).padStart(4,'0')}:${device.productId.toString(16).padStart(4,'0')}`;
    button.onclick = () => window.familyGear.choose(device.deviceId); container.append(button);
  }
});
document.getElementById('cancel').onclick = () => window.familyGear.choose('');
