package expo.modules.callproximity

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class CallProximityModule : Module(), SensorEventListener {
  private var sensorManager: SensorManager? = null
  private var proximitySensor: Sensor? = null
  private var isListening = false

  override fun definition() = ModuleDefinition {
    Name("CallProximity")
    Events("onProximityChanged")

    AsyncFunction("start") {
      startMonitoring()
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("stop") {
      stopMonitoring()
    }.runOnQueue(Queues.MAIN)

    OnDestroy {
      stopMonitoring()
    }
  }

  private fun startMonitoring(): Boolean {
    val context = appContext.reactContext ?: return false
    val manager = context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
      ?: return false
    val sensor = manager.getDefaultSensor(Sensor.TYPE_PROXIMITY) ?: return false

    if (!isListening) {
      val registered = manager.registerListener(
        this,
        sensor,
        SensorManager.SENSOR_DELAY_NORMAL,
        Handler(Looper.getMainLooper())
      )
      if (!registered) {
        return false
      }
    }

    sensorManager = manager
    proximitySensor = sensor
    isListening = true
    return true
  }

  private fun stopMonitoring() {
    if (isListening) {
      sensorManager?.unregisterListener(this)
    }
    sensorManager = null
    proximitySensor = null
    isListening = false
  }

  override fun onSensorChanged(event: SensorEvent?) {
    val distance = event?.values?.firstOrNull() ?: return
    val maxRange = proximitySensor?.maximumRange ?: return
    sendEvent("onProximityChanged", mapOf("near" to (distance < maxRange)))
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
}
