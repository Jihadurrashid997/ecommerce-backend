Pod::Spec.new do |s|
  s.name           = 'CallProximity'
  s.version        = '1.0.0'
  s.summary        = 'Proximity sensor events for Messenger call audio routing.'
  s.description    = s.summary
  s.license        = { :type => 'MIT' }
  s.author         = 'JR Messenger'
  s.homepage       = 'https://github.com/Jihadurrashid997/ecommerce-backend'
  s.platforms      = { :ios => '16.4' }
  s.source         = { :git => s.homepage }
  s.swift_version  = '5.9'
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,mm,swift}'
end
