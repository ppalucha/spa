/* vim: set ts=2 sw=2 expandtab : */

$(document).ready(function() {

  $.ajax({
    url: '/api/ds-name',
    data: {
      id: $('#ds_id').text(),
    },
    success: function(res) {
      $('#ds_name').text(res);
    }
  });

  $('#recalc-ds-btn').on('click', function () {
    var $btn = $(this).button('calculate');
    $btn.addClass('disabled');
    $.ajax({
      url: '/api/recalc-ds',
      type: 'get',
      data: { id: $('#ds_id').text() },
      success: function() {
        $btn.button('reset');
        $btn.removeClass('disabled');
        $('#recalc-alert').removeClass('hidden');
      },
    });
  });

});


