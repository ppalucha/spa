/* vim: set ts=2 sw=2 expandtab : */

$(document).ready(function() {


  $('#reparse-awr-btn').on('click', function () {
    var $btn = $(this).button('parse');
    $btn.addClass('disabled');
    $.ajax({
      url: '/api/reparse-awr',
      type: 'get',
      success: function() {
        $btn.button('reset');
        $btn.removeClass('disabled');
      },
    });
  });

});


