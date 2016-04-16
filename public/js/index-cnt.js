/* vim: set ts=2 sw=2 expandtab : */
  
$(document).ready(function() {
  
  /* load count of AWR files */
  $.ajax({
    url: '/api/awr-cnt',
    type: 'get',
    success: function(ret) {
      $('#awr-cnt').text(ret);
    },
  });

  /* load count of data sets */
  $.ajax({
    url: '/api/ds-cnt',
    type: 'get',
    success: function(ret) {
      $('#ds-cnt').text(ret);
    },
  });
 

});


