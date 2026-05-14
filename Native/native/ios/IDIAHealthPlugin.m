#import <Capacitor/Capacitor.h>

CAP_PLUGIN(IDIAHealthPlugin, "IDIAHealth",
    CAP_PLUGIN_METHOD(checkAvailability, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(requestPermissions, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(checkPermissions, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getHealthData, CAPPluginReturnPromise);
)
