module.exports=function(api){const isTest=api.env('test');api.cache(false);return{presets:['babel-preset-expo',...(isTest?[]:['nativewind/babel'])],plugins:[]};};
